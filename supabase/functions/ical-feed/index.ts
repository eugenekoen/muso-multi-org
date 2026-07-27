// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Live iCal / Webcal Subscription Feed Edge Function
 * Returns RFC 5545 compliant text/calendar (.ics) for a user's scheduled services.
 */

serve(async (req) => {
    // Enable CORS for cross-origin requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    try {
        const url = new URL(req.url)
        const token = url.searchParams.get('token')

        if (!token) {
            return new Response('Missing calendar token parameter', { 
                status: 400,
                headers: { 'Content-Type': 'text/plain' }
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Call RPC function to get user schedules by token
        const { data: rows, error: rpcError } = await supabase
            .rpc('get_user_schedule_by_calendar_token', { p_token: token })

        if (rpcError) {
            console.error('RPC Error:', rpcError)
            return new Response('Error retrieving schedule', { status: 500 })
        }

        if (!rows || rows.length === 0) {
            // Generate empty valid iCal calendar if user has no assigned schedules
            const emptyIcal = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Muso App//Worship Schedule Calendar//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'X-WR-CALNAME:Muso Worship Schedule',
                'END:VCALENDAR'
            ].join('\r\n')

            return new Response(emptyIcal, {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Content-Disposition': 'inline; filename="muso-schedule.ics"',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Access-Control-Allow-Origin': '*'
                }
            })
        }

        // Collect all user IDs from all rosters to resolve names
        const userIds = new Set<string>()

        const addIds = (val: any) => {
            if (!val) return
            if (Array.isArray(val)) {
                val.forEach((id: any) => { if (id && typeof id === 'string') userIds.add(id) })
            } else if (typeof val === 'string') {
                userIds.add(val)
            } else if (typeof val === 'object') {
                Object.values(val).forEach(v => addIds(v))
            }
        }

        rows.forEach((r: any) => {
            if (r.user_id) userIds.add(r.user_id)
            if (r.all_team) {
                const t = r.all_team
                addIds(t.leader)
                addIds(t.bass)
                addIds(t.keys)
                addIds(t.piano)
                addIds(t.drums)
                addIds(t.sound)
                addIds(t.av)
                addIds(t.guitars)
                addIds(t.guitar_ids)
                addIds(t.vocals)
                addIds(t.vocals_ids)
                addIds(t.custom)
            }
        })

        // Fetch names map for user IDs from profiles
        const nameMap: Record<string, string> = {}
        if (userIds.size > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', Array.from(userIds))

            if (profiles) {
                profiles.forEach((p: any) => {
                    if (p.id) nameMap[p.id] = p.full_name || 'Team Member'
                })
            }
        }

        const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        const userName = rows[0]?.user_name || 'Member'
        const calName = `Muso Worship Schedule - ${userName}`

        const icalLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Muso App//Worship Schedule Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${escapeIcalText(calName)}`,
            'X-WR-TIMEZONE:UTC'
        ]

        rows.forEach((row: any) => {
            const dateStr = row.service_date // YYYY-MM-DD
            if (!dateStr) return

            const dateClean = dateStr.replace(/-/g, '') // YYYYMMDD
            
            // Calculate next day date for ALL-DAY end date
            const dtObj = new Date(dateStr + 'T00:00:00Z')
            const nextDayObj = new Date(dtObj.getTime() + 86400000)
            const nextDayClean = nextDayObj.toISOString().split('T')[0].replace(/-/g, '')

            const assignedRoles = Array.isArray(row.assigned_roles) && row.assigned_roles.length > 0
                ? row.assigned_roles.join(', ')
                : 'Scheduled Service'

            const orgName = row.organization_name || 'Worship Team'
            const summary = `${assignedRoles} @ ${orgName}`

            // Helper to get resolved names string
            const getNamesStr = (ids: any): string => {
                if (!ids) return ''
                if (Array.isArray(ids)) {
                    return ids.map((id: string) => nameMap[id]).filter(Boolean).join(', ')
                }
                if (typeof ids === 'string' && nameMap[ids]) {
                    return nameMap[ids]
                }
                return ''
            }

            // Build Full Team Roster Lines (e.g. Leader: Tammy, Bass: Eugene, Vocals: Zime, Zoe)
            const rosterLines: string[] = []
            if (row.all_team) {
                const t = row.all_team

                const leader = getNamesStr(t.leader)
                if (leader) rosterLines.push(`Leader: ${leader}`)

                const keys = getNamesStr(t.keys)
                if (keys) rosterLines.push(`Keys: ${keys}`)

                const piano = getNamesStr(t.piano)
                if (piano) rosterLines.push(`Piano: ${piano}`)

                const drums = getNamesStr(t.drums)
                if (drums) rosterLines.push(`Drums: ${drums}`)

                const bass = getNamesStr(t.bass)
                if (bass) rosterLines.push(`Bass: ${bass}`)

                const guitars = getNamesStr(t.guitars || t.guitar_ids)
                if (guitars) rosterLines.push(`Guitar: ${guitars}`)

                const vocals = getNamesStr(t.vocals || t.vocals_ids)
                if (vocals) rosterLines.push(`Vocals: ${vocals}`)

                const sound = getNamesStr(t.sound)
                if (sound) rosterLines.push(`Sound: ${sound}`)

                const av = getNamesStr(t.av)
                if (av) rosterLines.push(`AV: ${av}`)

                // Include Custom Roles dynamically
                if (t.custom && typeof t.custom === 'object') {
                    for (const [customRoleName, customVal] of Object.entries(t.custom)) {
                        const customNames = getNamesStr(customVal)
                        if (customNames) {
                            rosterLines.push(`${customRoleName}: ${customNames}`)
                        }
                    }
                }
            }

            let description = `Your Assignment: ${assignedRoles}\nOrganization: ${orgName}`
            if (rosterLines.length > 0) {
                description += `\n\nFull Service Team Roster:\n• ${rosterLines.join('\n• ')}`
            }

            icalLines.push('BEGIN:VEVENT')
            icalLines.push(`UID:muso-${row.schedule_id || 'svc'}-${row.user_id}@muso.app`)
            icalLines.push(`DTSTAMP:${nowUtc}`)
            icalLines.push(`DTSTART;VALUE=DATE:${dateClean}`)
            icalLines.push(`DTEND;VALUE=DATE:${nextDayClean}`)
            icalLines.push(`SUMMARY:${escapeIcalText(summary)}`)
            icalLines.push(`DESCRIPTION:${escapeIcalText(description)}`)
            icalLines.push('STATUS:CONFIRMED')
            icalLines.push('END:VEVENT')
        })

        icalLines.push('END:VCALENDAR')

        const icalContent = icalLines.join('\r\n')

        return new Response(icalContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="muso-schedule.ics"',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            }
        })

    } catch (err: any) {
        console.error('Unhandled Edge Function Error:', err)
        return new Response('Internal Server Error', { status: 500 })
    }
})

/**
 * Escapes characters per RFC 5545 iCalendar specification
 */
function escapeIcalText(str: string): string {
    if (!str) return ''
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
}
