import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

/**
 * send-schedule-reminders
 * Triggered every Wednesday to notify Sunday's team using Zoho SMTP.
 */

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // SMTP Config from Supabase Secrets
        const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.zoho.com'
        const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
        const smtpUser = Deno.env.get('SMTP_USER') // Your Zoho email
        const smtpPass = Deno.env.get('SMTP_PASS') // The App Password you generated

        // 1. Calculate upcoming Sunday
        const today = new Date()
        const daysUntilSunday = (7 - today.getDay()) % 7
        const sundayDate = new Date(today)
        sundayDate.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday))
        const dateString = sundayDate.toISOString().split('T')[0]

        console.log(`Checking Sunday: ${dateString}`)

        // 2. Fetch all schedules for this Sunday
        const { data: schedules, error: scheduleError } = await supabase
            .from('service_schedules')
            .select('*, organizations(name)')
            .eq('service_date', dateString)

        if (scheduleError) throw scheduleError

        console.log(`Found ${schedules?.length || 0} schedules for ${dateString}`)

        if (!schedules || schedules.length === 0) {
            return new Response(JSON.stringify({ message: `No schedules found for ${dateString}` }), { status: 200 })
        }

        const results = []

        // 3. Setup Nodemailer Transporter
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for 587
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        })

        // 4. Process each organization's schedule
        for (const schedule of schedules) {
            const orgName = schedule.organizations?.name || "Your Team"

            // Collect all user IDs involved
            const userIds = new Set()
            const rolesMap = {
                'Leader': schedule.leader_id,
                'Bass': schedule.bass_id,
                'Keys': schedule.keys_id,
                'Piano': schedule.piano_id,
                'Drums': schedule.drums_id,
                'Sound': schedule.sound_id,
                'AV': schedule.av_id,
            }

            Object.values(rolesMap).forEach(id => { if (id) userIds.add(id) })
            if (schedule.guitar_ids) schedule.guitar_ids.forEach(id => userIds.add(id))
            if (schedule.vocals_ids) schedule.vocals_ids.forEach(id => userIds.add(id))

            if (schedule.custom_roles) {
                Object.values(schedule.custom_roles).forEach(val => {
                    if (Array.isArray(val)) val.forEach(id => userIds.add(id))
                    else if (val) userIds.add(val)
                })
            }

            console.log(`Org: ${orgName}, User IDs collected: ${userIds.size}`)

            if (userIds.size === 0) {
                console.log(`No users scheduled for org ${orgName}`)
                continue
            }

            // 5. Fetch Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', Array.from(userIds))

            if (profileError) {
                console.error(`Error fetching profiles for ${orgName}:`, profileError)
                continue
            }

            console.log(`Found ${profiles?.length || 0} profiles in DB for org ${orgName}`)

            // 6. Build Team Detail List
            const getProfile = (id) => profiles.find(p => p.id === id) || { full_name: 'Unknown', email: null }
            const teamDetails = []

            // Standard roles
            Object.entries(rolesMap).forEach(([role, id]) => {
                if (id) teamDetails.push({ role, name: getProfile(id).full_name })
            })
            if (schedule.guitar_ids) schedule.guitar_ids.forEach(id => teamDetails.push({ role: 'Guitar', name: getProfile(id).full_name }))
            if (schedule.vocals_ids) schedule.vocals_ids.forEach(id => teamDetails.push({ role: 'Vocals', name: getProfile(id).full_name }))

            // Custom roles
            if (schedule.custom_roles) {
                Object.entries(schedule.custom_roles).forEach(([roleName, val]) => {
                    if (Array.isArray(val)) val.forEach(id => teamDetails.push({ role: roleName, name: getProfile(id).full_name }))
                    else if (val) teamDetails.push({ role: roleName, name: getProfile(val).full_name })
                })
            }

            // 7. Send individual emails
            for (const profile of profiles) {
                if (!profile.email) {
                    console.log(`Skipping ${profile.full_name} (no email)`)
                    continue
                }

                const html = generateEmailHtml(profile.full_name, orgName, dateString, teamDetails)

                try {
                    console.log(`Attempting send to: ${profile.email}`)
                    await transporter.sendMail({
                        from: smtpUser,
                        to: profile.email,
                        subject: `Reminder: You are scheduled for Sunday, ${formatDate(sundayDate)}`,
                        html: html,
                    })
                    console.log(`✅ Email sent to ${profile.email}`)
                    results.push(`Sent to ${profile.email}`)
                } catch (sendErr) {
                    console.error(`❌ Send error to ${profile.email}:`, sendErr.message)
                    results.push(`Failed for ${profile.email}: ${sendErr.message}`)
                }
            }
        }

        return new Response(JSON.stringify({ message: "Sync complete", details: results }), { status: 200 })

    } catch (error) {
        console.error("Critical Error:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})

function formatDate(date) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function generateEmailHtml(userName, orgName, date, team) {
    const teamRows = team.map(member => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${member.role}</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${member.name}</td>
    </tr>
  `).join('')

    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background: #1a1a1a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Worship Team Reminder</h1>
        <p style="margin: 5px 0 0; opacity: 0.8;">${orgName}</p>
      </div>
      <div style="padding: 20px; color: #333;">
        <p>Hi <strong>${userName}</strong>,</p>
        <p>This is a friendly reminder that you are scheduled to serve this coming Sunday, <strong>${date}</strong>.</p>
        <h3 style="border-bottom: 2px solid #1a1a1a; padding-bottom: 5px; margin-top: 30px;">This Week's Team</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9f9f9;">
              <th style="text-align: left; padding: 8px;">Role</th>
              <th style="text-align: left; padding: 8px;">Member</th>
            </tr>
          </thead>
          <tbody>
            ${teamRows}
          </tbody>
        </table>
        <p style="margin-top: 30px;">We look forward to seeing you there!</p>
        <p>Blessings, <br>The ${orgName} Team</p>
      </div>
      <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #777;">
        Sent via <a href="https://mihn.co.za" style="color: #1a1a1a; text-decoration: none; font-weight: bold;">Music In His Name</a>
      </div>
    </div>
  `
}
