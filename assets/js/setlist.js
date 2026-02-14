/**
 * Setlist Module
 * Handles setlist management, drag-drop reordering
 */

let currentSetlist = [];
const setlistLabel = 'current_weekend';
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
        // Check if cache exists, is not expired, AND has actual content
        if (!cached || !cached.expiresAt || cached.expiresAt < now) return true;
        // Verify that at least one content type has actual data
        const hasContent = (cached.chordsContent && cached.chordsContent.trim().length > 0) ||
            (cached.lyricsContent && cached.lyricsContent.trim().length > 0);
        return !hasContent; // Re-fetch if no content found
    });

    if (identifiersToFetch.length === 0)
    {
        console.log(`[Prefetch] All ${songIdentifiers.length} songs already cached with content.`);
        return;
    }

    console.log(`[Prefetch] Fetching ${identifiersToFetch.length}/${songIdentifiers.length} songs...`);

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
            console.log(`[Prefetch] Cached song: ${song.display_name || song.song_identifier} - Chords: ${(song.chords_content || '').length}b, Lyrics: ${(song.lyrics_content || '').length}b`);
        });
    } catch (e)
    {
        console.warn('Setlist prefetch failed. Songs may be unavailable offline.', e);
    } finally
    {
        isPrefetchingSetlist = false;
    }
}

/**
 * Ensures all songs on the current setlist are properly cached in localStorage.
 * This function force-fetches songs regardless of cache status and is suitable for
 * calling when the user comes back online to guarantee all setlist songs are available offline.
 * @param {string} organizationId - The organization ID
 */
async function ensureSetlistSongsAreCachedOnline(organizationId)
{
    if (!organizationId || !Array.isArray(currentSetlist) || currentSetlist.length === 0) return;

    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient) return;

    const songIdentifiers = [...new Set(currentSetlist
        .map(item => item?.songName)
        .filter(Boolean))];

    if (songIdentifiers.length === 0) return;

    try
    {
        console.log(`[Online Sync] Ensuring ${songIdentifiers.length} setlist songs are cached...`);

        const { data, error } = await supabaseClient
            .from('songs')
            .select('song_identifier, display_name, chords_content, lyrics_content')
            .eq('organization_id', organizationId)
            .in('song_identifier', songIdentifiers);

        if (error) throw error;

        const now = Date.now();
        const expiresAt = now + OFFLINE_CACHE_TTL_MS;
        const fetchedSongs = {};

        (data || []).forEach(song =>
        {
            fetchedSongs[song.song_identifier] = true;
            const cachePayload = {
                songIdentifier: song.song_identifier,
                displayName: song.display_name || '',
                chordsContent: song.chords_content || '',
                lyricsContent: song.lyrics_content || '',
                cachedAt: now,
                expiresAt: expiresAt
            };
            const cacheKey = getSongCacheKey(organizationId, song.song_identifier);
            localStorage.setItem(cacheKey, JSON.stringify(cachePayload));

            // Detailed logging for verification
            const chordsSize = (song.chords_content || '').length;
            const lyricsSize = (song.lyrics_content || '').length;
            console.log(`[Online Sync] ✓ ${song.display_name || song.song_identifier} - Chords: ${chordsSize}b, Lyrics: ${lyricsSize}b`);
        });

        // Log any songs that weren't found in the database
        const missingSongs = songIdentifiers.filter(id => !fetchedSongs[id]);
        if (missingSongs.length > 0)
        {
            console.warn(`[Online Sync] ${missingSongs.length} songs on setlist not found in database:`, missingSongs);
        }

        console.log(`[Online Sync] Cache sync complete. ${Object.keys(fetchedSongs).length}/${songIdentifiers.length} songs cached.`);

    } catch (error)
    {
        console.error('[Online Sync] Failed to ensure setlist songs are cached:', error);
    }
}

/**
 * Verifies that all songs in the current setlist are properly cached with content
 * @param {string} organizationId - The organization ID
 * @returns {Object} - Status object with summary
 */
function verifySetlistCache(organizationId)
{
    if (!organizationId || !Array.isArray(currentSetlist) || currentSetlist.length === 0)
    {
        return { total: 0, cached: 0, missing: [], incomplete: [] };
    }

    const songIdentifiers = [...new Set(currentSetlist
        .map(item => item?.songName)
        .filter(Boolean))];

    const missing = [];
    const incomplete = [];
    let cached = 0;

    songIdentifiers.forEach(identifier =>
    {
        const cachedSong = readSongCache(organizationId, identifier);

        if (!cachedSong)
        {
            missing.push(identifier);
            return;
        }

        const hasChords = cachedSong.chordsContent && cachedSong.chordsContent.trim().length > 0;
        const hasLyrics = cachedSong.lyricsContent && cachedSong.lyricsContent.trim().length > 0;

        if (!hasChords && !hasLyrics)
        {
            incomplete.push({ identifier, reason: 'No content' });
        } else
        {
            cached++;
        }
    });

    const status = {
        total: songIdentifiers.length,
        cached: cached,
        missing: missing,
        incomplete: incomplete
    };

    console.log(`[Cache Verification] ${cached}/${songIdentifiers.length} songs ready - Missing: ${missing.length}, Incomplete: ${incomplete.length}`);

    if (missing.length > 0)
    {
        console.warn('[Cache Verification] Missing songs:', missing);
    }
    if (incomplete.length > 0)
    {
        console.warn('[Cache Verification] Incomplete songs:', incomplete);
    }

    return status;
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

    // CRITICAL: Ensure ALL songs are cached when loading online
    // Use ensureSetlistSongsAreCachedOnline when online to force-fetch all songs
    // This guarantees complete caching before the user might go offline
    if (navigator.onLine)
    {
        console.log('[Setlist Load] Online detected - ensuring all songs are cached...');
        await ensureSetlistSongsAreCachedOnline(organizationId);
        verifySetlistCache(organizationId);
        // Update cache dots & show toast
        if (window.songsModule && window.songsModule.updateCacheDots)
        {
            window.songsModule.updateCacheDots(organizationId);
        }
        const setlistCount = currentSetlist.length;
        if (setlistCount > 0 && window.songsModule && window.songsModule.showSongCacheToast)
        {
            window.songsModule.showSongCacheToast(`${setlistCount} setlist song${setlistCount !== 1 ? 's' : ''} cached for offline`);
        }
    } else
    {
        console.log('[Setlist Load] Offline - using prefetch for any missing songs...');
        await prefetchSetlistSongs(organizationId);
        verifySetlistCache(organizationId);
        if (window.songsModule && window.songsModule.updateCacheDots)
        {
            window.songsModule.updateCacheDots(organizationId);
        }
    }
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
    const canCheckCache = !!(orgId && window.songsModule && window.songsModule.isSongContentCached);

    currentSetlist.forEach(item =>
    {
        const { songName, displayName = 'Unknown Song', key = '?' } = item || {};
        if (!songName) return;

        const hasChordsCache = canCheckCache && window.songsModule.isSongContentCached(orgId, songName, 'chords');
        const hasLyricsCache = canCheckCache && window.songsModule.isSongContentCached(orgId, songName, 'lyrics');

        const row = tableOneBody.insertRow();
        row.innerHTML = `
            <td>${displayName}</td>
            <td class="text-center selected-key">${key}</td>
            <td class="text-center">
                <a href="#" data-song-identifier="${songName}" data-content-type="chords" title="Chords"><i class="fa-solid fa-music"></i></a>
                <span class="cache-dot ${hasChordsCache ? 'cached' : ''}" data-cache-type="chords" data-song-id="${songName}" title="${hasChordsCache ? 'Available offline' : 'Not cached for offline'}"></span>
            </td>
            <td class="text-center">
                <a href="#" data-song-identifier="${songName}" data-content-type="lyrics" title="Lyrics"><i class="fa-solid fa-align-left"></i></a>
                <span class="cache-dot ${hasLyricsCache ? 'cached' : ''}" data-cache-type="lyrics" data-song-id="${songName}" title="${hasLyricsCache ? 'Available offline' : 'Not cached for offline'}"></span>
            </td>
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
    ensureSetlistSongsAreCachedOnline,
    prefetchSetlistSongs,
    verifySetlistCache
};
