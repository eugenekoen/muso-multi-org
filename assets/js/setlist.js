/**
 * Setlist Module
 * Handles setlist management, drag-drop reordering
 */

let currentSetlist = [];
const setlistLabel = 'current_weekend';
const OFFLINE_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
let isPrefetchingSetlist = false;

function getSongCacheKey(organizationId, songIdentifier)
{
    return `cachedSong_${organizationId}_${songIdentifier}`;
}

function readSongCache(organizationId, songIdentifier)
{
    const cacheKey = getSongCacheKey(organizationId, songIdentifier);
    const cachedData = localStorage.getItem(cacheKey);
    if (!cachedData) return null;
    try
    {
        return JSON.parse(cachedData);
    } catch (e)
    {
        console.warn('Invalid cached song data', e);
        return null;
    }
}

async function prefetchSetlistSongs(organizationId)
{
    if (!organizationId || !Array.isArray(currentSetlist) || currentSetlist.length === 0) return;
    if (isPrefetchingSetlist) return;

    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient) return;

    const songIdentifiers = [...new Set(currentSetlist
        .map(item => item?.songName)
        .filter(Boolean))];

    if (songIdentifiers.length === 0) return;

    const now = Date.now();
    const identifiersToFetch = songIdentifiers.filter(identifier =>
    {
        const cached = readSongCache(organizationId, identifier);
        return !cached || !cached.expiresAt || cached.expiresAt < now;
    });

    if (identifiersToFetch.length === 0) return;

    isPrefetchingSetlist = true;
    try
    {
        const { data, error } = await supabaseClient
            .from('songs')
            .select('song_identifier, display_name, chords_content, lyrics_content')
            .eq('organization_id', organizationId)
            .in('song_identifier', identifiersToFetch);

        if (error) throw error;

        const expiresAt = now + OFFLINE_CACHE_TTL_MS;
        (data || []).forEach(song =>
        {
            const cachePayload = {
                songIdentifier: song.song_identifier,
                displayName: song.display_name || '',
                chordsContent: song.chords_content || '',
                lyricsContent: song.lyrics_content || '',
                cachedAt: now,
                expiresAt: expiresAt
            };
            localStorage.setItem(getSongCacheKey(organizationId, song.song_identifier), JSON.stringify(cachePayload));
        });
    } catch (e)
    {
        console.warn('Setlist prefetch failed. Songs may be unavailable offline.', e);
    } finally
    {
        isPrefetchingSetlist = false;
    }
}

async function loadSetlistFromSupabase(organizationId)
{
    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient) return;

    // If no organization is selected, clear the setlist and return
    if (!organizationId)
    {
        currentSetlist = [];
        updateTableOneWithSetlist();
        return;
    }

    // --- INSTANT CACHE LOAD ---
    const cacheKey = `cachedSetlist_${organizationId}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData)
    {
        try
        {
            console.log("Loading setlist from cache...");
            currentSetlist = JSON.parse(cachedData);
            updateTableOneWithSetlist(); // Render immediately
        } catch (e) { console.warn("Invalid cached setlist", e); }
    }

    try
    {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 3000);

        const { data, error } = await supabaseClient.from('setlists').select('songs')
            .eq('organization_id', organizationId)
            .eq('label', setlistLabel).maybeSingle()
            .abortSignal(abortController.signal);

        clearTimeout(timeoutId);

        if (error) throw error;
        currentSetlist = (data && data.songs) ? data.songs : [];

        // Update Cache
        localStorage.setItem(cacheKey, JSON.stringify(currentSetlist));

    } catch (e)
    {
        const isAbort = e.name === 'AbortError' || (e.message && typeof e.message === 'string' && e.message.includes('AbortError'));
        if (isAbort)
        {
            console.warn("Setlist fetch timed out. Using cache.");
        } else
        {
            console.error("Error loading setlist", e);
        }
        // If it timed out, don't clear the list if we already have something
    }
    updateTableOneWithSetlist();
    prefetchSetlistSongs(organizationId);
}

async function saveSetlistToSupabase()
{
    const supabaseClient = window.getSupabaseClient();
    const organizationId = window.activeOrganizationId;

    if (!supabaseClient || !organizationId)
    {
        console.error("Cannot save setlist: No active organization.");
        return;
    }

    // --- CRITICAL: Update Cache Immediately ---
    // If we rely only on the DB save, a refresh before the save completes (or on timeout)
    // will revert to the old cache.
    const cacheKey = `cachedSetlist_${organizationId}`;
    localStorage.setItem(cacheKey, JSON.stringify(currentSetlist));

    try
    {
        const { error } = await supabaseClient.from('setlists').upsert({
            organization_id: organizationId,
            label: setlistLabel,
            songs: currentSetlist
        }, { onConflict: 'organization_id, label' });

        if (error) throw error;
        console.log('Setlist saved successfully.');
        prefetchSetlistSongs(organizationId);
    } catch (error)
    {
        console.error('Error saving setlist:', error);
        alert('Failed to save setlist.');
    }
}

function updateTableOneWithSetlist()
{
    const tableOneBody = document.querySelector('#tableone tbody');
    if (!tableOneBody) return;
    tableOneBody.innerHTML = '';
    if (!Array.isArray(currentSetlist) || currentSetlist.length === 0)
    {
        const msg = window.activeOrganizationId
            ? 'Setlist is empty for this weekend.'
            : 'Please select a church to view the setlist.';
        tableOneBody.innerHTML = `<tr><td colspan="4" class="text-center">${msg}</td></tr>`;
        return;
    }
    const orgId = window.activeOrganizationId;
    currentSetlist.forEach(item =>
    {
        const { songName, displayName = 'Unknown Song', key = '?' } = item || {};
        if (!songName) return;

        // Check if this song has fresh cache
        let chordsBadge = '';
        let lyricsBadge = '';
        if (orgId)
        {
            const cached = readSongCache(orgId, songName);
            const isFresh = cached && cached.expiresAt && cached.expiresAt > Date.now();
            if (isFresh && cached.chordsContent)
            {
                chordsBadge = ' <i class="fa-solid fa-circle cached-badge" title="Available offline"></i>';
            }
            if (isFresh && cached.lyricsContent)
            {
                lyricsBadge = ' <i class="fa-solid fa-circle cached-badge" title="Available offline"></i>';
            }
        }

        const row = tableOneBody.insertRow();
        row.innerHTML = `
            <td>${displayName}</td>
            <td class="text-center selected-key">${key}</td>
            <td class="text-center"><a href="#" data-song-identifier="${songName}" data-content-type="chords" title="Chords"><i class="fa-solid fa-music"></i></a>${chordsBadge}</td>
            <td class="text-center"><a href="#" data-song-identifier="${songName}" data-content-type="lyrics" title="Lyrics"><i class="fa-solid fa-align-left"></i></a>${lyricsBadge}</td>
        `;
    });
}

function renderSetlistUI()
{
    const currentSetlistItemsUl = document.getElementById('current-setlist-items');
    if (!currentSetlistItemsUl) return;
    currentSetlistItemsUl.innerHTML = '';
    if (!Array.isArray(currentSetlist) || currentSetlist.length === 0)
    {
        currentSetlistItemsUl.innerHTML = '<li>Setlist is empty.</li>';
        return;
    }
    currentSetlist.forEach((item, index) =>
    {
        const listItem = document.createElement('li');
        listItem.setAttribute('draggable', 'true');
        listItem.dataset.index = index;
        listItem.innerHTML = `
            <span class="drag-handle">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 5.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                </svg>
            </span>
            <span class="song-name">${item.displayName} (${item.key})</span>
            <button class="remove-song-btn" data-index="${index}" aria-label="Remove ${item.displayName}">Remove</button>
        `;
        currentSetlistItemsUl.appendChild(listItem);
    });
}

async function addSongToSetlist(songFileIdentifier, displayName, key)
{
    const songSearchInput = document.getElementById('song-search-input');
    currentSetlist.push({ songName: songFileIdentifier, displayName: displayName, key: key });
    renderSetlistUI();
    await saveSetlistToSupabase();
    songSearchInput.value = '';
}

// Export functions
window.setlistModule = {
    loadSetlistFromSupabase,
    saveSetlistToSupabase,
    updateTableOneWithSetlist,
    renderSetlistUI,
    addSongToSetlist,
    getCurrentSetlist: () => currentSetlist,
    setCurrentSetlist: (newSetlist) => { currentSetlist = newSetlist; },
    getSongCacheKey,
    readSongCache,
    OFFLINE_CACHE_TTL_MS
};
