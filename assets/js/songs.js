/**
 * Songs Module
 * Handles song CRUD operations and song database management
 */

let allSongsData = [];

async function populateSongDatabaseTable(organizationId)
{
    const supabaseClient = window.getSupabaseClient();
    const tableTwoBody = document.querySelector('#tabletwo tbody');

    if (!supabaseClient || !tableTwoBody) return;
    tableTwoBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading song database...</td></tr>';

    // If no organization is selected, show a message and stop.
    if (!organizationId)
    {
        tableTwoBody.innerHTML = '<tr><td colspan="4" class="text-center">Please select a church to view songs.</td></tr>';
        allSongsData = [];
        // Ensure Edit header is hidden if we are logged out / no org selected
        const editHeader = document.querySelector('#tabletwo thead .edit-col');
        if (editHeader) editHeader.style.display = 'none';
        return;
    }

    // --- INSTANT CACHE LOAD ---
    const cacheKey = `cachedSongs_${organizationId}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData)
    {
        try
        {
            console.log("Loading songs from cache...");
            allSongsData = JSON.parse(cachedData);
            renderSongTable(); // Render immediately
        } catch (e) { console.warn("Invalid cached songs", e); }
    } else
    {
        tableTwoBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading song database...</td></tr>';
    }

    try
    {
        // Add 7s timeout to prevent hanging "Loading..."
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 3000);

        const { data, error } = await supabaseClient.from('songs')
            .select('song_identifier, display_name')
            .eq('organization_id', organizationId)
            .order('display_name', { ascending: true })
            .abortSignal(abortController.signal);

        clearTimeout(timeoutId);

        if (error) throw error;

        // Update Cache
        allSongsData = data.map(song => ({ identifier: song.song_identifier, displayName: song.display_name }));
        localStorage.setItem(cacheKey, JSON.stringify(allSongsData));

        renderSongTable(); // Re-render with fresh data

    } catch (error)
    {
        // Silence AbortError (Timeouts) if we have data
        // Check both name and message to be safe
        const isAbort = error.name === 'AbortError' || (error.message && typeof error.message === 'string' && error.message.includes('AbortError'));

        if (isAbort)
        {
            console.warn('Song fetch timed out. Keeping cached data.');
        } else
        {
            console.error('Error loading song database:', error);
        }

        // Only show error in UI if we have NO data. If we have cache, keep showing it.
        if (allSongsData.length === 0)
        {
            const msg = error.name === 'AbortError' ? 'Network timeout. Please refresh.' : 'Error loading songs.';
            tableTwoBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: red;">${msg}</td></tr>`;
        }
    }
}

function renderSongTable()
{
    const tableTwoBody = document.querySelector('#tabletwo tbody');
    if (!tableTwoBody) return;

    tableTwoBody.innerHTML = '';
    if (allSongsData.length === 0)
    {
        tableTwoBody.innerHTML = '<tr><td colspan="4" class="text-center">No songs found in the database.</td></tr>';
        return;
    }
    const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
    const canEdit = !!(currentUserRole && String(currentUserRole).toLowerCase() === 'admin');

    // Toggle Header Visibility
    const editHeader = document.querySelector('#tabletwo thead .edit-col');
    if (editHeader)
    {
        editHeader.style.display = canEdit ? '' : 'none';
    }

    allSongsData.forEach(song =>
    {
        const row = tableTwoBody.insertRow();

        let editCellHtml = '';
        if (canEdit)
        {
            editCellHtml = `<td class="edit-col text-center"><a href="#" class="edit-btn" data-song-identifier="${song.identifier}" data-display-name="${song.displayName}">Edit</a></td>`;
        } else
        {
            // If not admin, we don't render the cell at all if we are hiding the column. 
            // However, the header is "display: none". So we should prob make the cell "display: none" too 
            // OR just not render it if the table structure requires matching columns.
            // Better to match the existing structure: use class edit-col and toggle display via CSS or JS loop?
            // Since we are rebuilding the row, let's just make the cell hidden style if !canEdit
            editCellHtml = `<td class="edit-col text-center" style="display: none;"><span style="color:#ccc;">-</span></td>`;
        }

        // Wait, if we use display:none on the header, we must use it on the cell too.
        // Or we can just omit the column entirely from HTML?
        // But the original code had 4 columns.
        // Let's use the style approach for simplest integration.

        row.innerHTML = `
            <td>${song.displayName}</td>
            <td class="edit-col text-center" style="${canEdit ? '' : 'display:none'}">
                <a href="#" class="edit-btn" data-song-identifier="${song.identifier}" data-display-name="${song.displayName}">Edit</a>
            </td>
            <td class="text-center">
                <a href="#" data-song-identifier="${song.identifier}" data-content-type="chords" title="Chords"><i class="fa-solid fa-music"></i></a>
            </td>
            <td class="text-center">
                <a href="#" data-song-identifier="${song.identifier}" data-content-type="lyrics" title="Lyrics"><i class="fa-solid fa-align-left"></i></a>
            </td>
        `;
    });
}

async function openEditModal(songIdentifier, displayName)
{
    const supabaseClient = window.getSupabaseClient();
    const editSongModal = document.getElementById('edit-song-modal');
    const editSongMsg = document.getElementById('edit-song-msg');
    const editSongTitle = document.getElementById('edit-song-title');
    const editSongTextarea = document.getElementById('edit-song-textarea');
    const editSongLyricsTextarea = document.getElementById('edit-song-lyrics-textarea');
    const saveSongBtn = document.getElementById('save-song-btn');
    const deleteSongBtn = document.getElementById('delete-song-btn');

    editSongMsg.textContent = '';
    editSongTitle.textContent = `Edit Song: ${displayName}`;
    editSongTextarea.value = 'Loading...';
    editSongLyricsTextarea.value = 'Loading...';
    const editSongShared = document.getElementById('edit-song-shared');
    if (editSongShared) editSongShared.value = 'false';
    editSongModal.style.display = 'block';
    saveSongBtn.dataset.songIdentifier = songIdentifier;

    // Reset delete button state and visibility based on role
    if (deleteSongBtn)
    {
        const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
        const isAdmin = !!(currentUserRole && String(currentUserRole).toLowerCase() === 'admin');
        if (isAdmin)
        {
            deleteSongBtn.style.display = 'inline-block';
            deleteSongBtn.disabled = false;
            deleteSongBtn.textContent = 'Delete Song';
        } else
        {
            deleteSongBtn.style.display = 'none';
        }
    }

    try
    {
        const orgId = window.activeOrganizationId;
        const { data, error } = await supabaseClient
            .from('songs')
            .select('chords_content, lyrics_content, is_shared')
            .eq('song_identifier', songIdentifier)
            .eq('organization_id', orgId)
            .single();
        if (error) throw error;
        editSongTextarea.value = data.chords_content || '';
        editSongLyricsTextarea.value = data.lyrics_content || '';
        if (editSongShared) editSongShared.value = String(data.is_shared || false);
    } catch (error)
    {
        editSongTextarea.value = 'Error loading song content.';
        editSongLyricsTextarea.value = 'Error loading lyrics content.';
        console.error('Error fetching song for edit:', error);
    }
}

async function saveSongChanges()
{
    const supabaseClient = window.getSupabaseClient();
    const saveSongBtn = document.getElementById('save-song-btn');
    const editSongModal = document.getElementById('edit-song-modal');
    const editSongMsg = document.getElementById('edit-song-msg');
    const editSongTextarea = document.getElementById('edit-song-textarea');
    const editSongLyricsTextarea = document.getElementById('edit-song-lyrics-textarea');

    const songIdentifier = saveSongBtn.dataset.songIdentifier;
    const newChordsContent = editSongTextarea.value;
    const newLyricsContent = editSongLyricsTextarea.value;
    const editSongShared = document.getElementById('edit-song-shared');
    const isShared = editSongShared ? editSongShared.value === 'true' : false;
    const orgId = window.activeOrganizationId;

    if (!songIdentifier) { alert('Error: No song identifier found.'); return; }
    saveSongBtn.disabled = true;
    saveSongBtn.textContent = 'Saving...';
    try
    {
        const { error } = await supabaseClient.from('songs').update({
            chords_content: newChordsContent,
            lyrics_content: newLyricsContent,
            is_shared: isShared
        })
            .eq('song_identifier', songIdentifier)
            .eq('organization_id', orgId);
        if (error) throw error;
        editSongMsg.textContent = 'Saved successfully!';
        editSongMsg.style.color = 'green';
        setTimeout(() => { editSongModal.style.display = 'none'; }, 1500);
    } catch (error)
    {
        editSongMsg.style.color = 'red';
        editSongMsg.textContent = `Error: ${error.message}`;
    } finally
    {
        saveSongBtn.disabled = false;
        saveSongBtn.textContent = 'Save Changes';
    }
}

async function deleteSong()
{
    const supabaseClient = window.getSupabaseClient();
    const saveSongBtn = document.getElementById('save-song-btn');
    const deleteSongBtn = document.getElementById('delete-song-btn');
    const editSongTitle = document.getElementById('edit-song-title');
    const editSongModal = document.getElementById('edit-song-modal');
    const editSongMsg = document.getElementById('edit-song-msg');

    // Security check
    const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
    const isAdmin = !!(currentUserRole && String(currentUserRole).toLowerCase() === 'admin');
    if (!isAdmin)
    {
        alert('You do not have permission to delete songs.');
        return;
    }

    const songIdentifier = saveSongBtn.dataset.songIdentifier;
    if (!songIdentifier) { alert('Error: No song identifier found.'); return; }

    const displayName = editSongTitle.textContent.replace('Edit Song: ', '');
    if (!confirm(`Are you sure you want to permanently delete "${displayName}"? This action cannot be undone.`))
    {
        return;
    }

    deleteSongBtn.disabled = true;
    deleteSongBtn.textContent = 'Deleting...';

    try
    {
        const orgId = window.activeOrganizationId;
        // Use .select() to ensure we get confirmation that a row was actually deleted
        const { data, error } = await supabaseClient
            .from('songs')
            .delete()
            .eq('song_identifier', songIdentifier)
            .eq('organization_id', orgId)
            .select();
        if (error) throw error;

        if (!data || data.length === 0)
        {
            throw new Error("Could not delete song. You may not have permission.");
        }

        editSongMsg.textContent = 'Song deleted successfully!';
        editSongMsg.style.color = 'green';
        setTimeout(() =>
        {
            editSongModal.style.display = 'none';
            // Refresh both songs and setlist
            populateSongDatabaseTable(orgId);
            if (window.setlistModule)
            {
                window.setlistModule.loadSetlistFromSupabase(orgId);
            }
        }, 1000);
    } catch (error)
    {
        editSongMsg.style.color = 'red';
        editSongMsg.textContent = `Error deleting song: ${error.message}`;
        deleteSongBtn.disabled = false;
        deleteSongBtn.textContent = 'Delete Song';
    }
}

async function openAddSongModal(organizationId)
{
    const addSongModal = document.getElementById('add-song-modal');
    const addSongErrorMsg = document.getElementById('add-song-error-msg');
    const newSongDisplayNameInput = document.getElementById('new-song-display-name');
    const newSongIdentifierInput = document.getElementById('new-song-identifier');

    if (!organizationId)
    {
        alert("Please select a church before adding a new song.");
        return;
    }

    const newSongChordsTextarea = document.getElementById('new-song-chords');
    const newSongLyricsTextarea = document.getElementById('new-song-lyrics');
    const SONG_TEMPLATE = `[KEY]
SONG NAME
=========
================================================
PASTE SONG HERE (with 2 spacings on left)
================================================`;

    addSongErrorMsg.textContent = '';
    newSongDisplayNameInput.value = '';
    newSongIdentifierInput.value = '';
    newSongChordsTextarea.value = SONG_TEMPLATE;
    newSongLyricsTextarea.value = '';
    const newSongShared = document.getElementById('new-song-shared');
    if (newSongShared) newSongShared.value = 'false';
    addSongModal.style.display = 'block';
    newSongDisplayNameInput.focus();
}

async function saveNewSong(organizationId)
{
    const supabaseClient = window.getSupabaseClient();
    const newSongDisplayNameInput = document.getElementById('new-song-display-name');
    const newSongIdentifierInput = document.getElementById('new-song-identifier');
    const newSongChordsTextarea = document.getElementById('new-song-chords');
    const newSongLyricsTextarea = document.getElementById('new-song-lyrics');
    const addSongErrorMsg = document.getElementById('add-song-error-msg');
    const saveNewSongBtn = document.getElementById('save-new-song-btn');
    const addSongModal = document.getElementById('add-song-modal');

    if (!organizationId)
    {
        addSongErrorMsg.textContent = 'Cannot save song: No active church selected.';
        return;
    }

    const displayName = newSongDisplayNameInput.value.trim();
    const identifier = newSongIdentifierInput.value.trim().toLowerCase();
    const chordsContent = newSongChordsTextarea.value;
    const lyricsContent = newSongLyricsTextarea.value;
    const newSongShared = document.getElementById('new-song-shared');
    const isShared = newSongShared ? newSongShared.value === 'true' : false;

    if (!displayName || !identifier)
    {
        addSongErrorMsg.textContent = 'Song Title and Identifier are required.';
        return;
    }
    if (!/^[a-z0-9-]+$/.test(identifier))
    {
        addSongErrorMsg.textContent = 'Identifier can only contain lowercase letters, numbers, and hyphens.';
        return;
    }
    saveNewSongBtn.disabled = true;
    saveNewSongBtn.textContent = 'Saving...';
    addSongErrorMsg.textContent = '';
    try
    {
        const { error } = await supabaseClient.from('songs').insert([{
            organization_id: organizationId,
            song_identifier: identifier,
            display_name: displayName,
            chords_content: chordsContent,
            lyrics_content: lyricsContent,
            is_shared: isShared
        }]);
        if (error)
        {
            if (error.code === '23505') { throw new Error(`Identifier '${identifier}' is already taken.`); }
            throw error;
        }
        addSongModal.style.display = 'none';
        await populateSongDatabaseTable(organizationId);
    } catch (error)
    {
        addSongErrorMsg.textContent = `Error: ${error.message}`;
    } finally
    {
        saveNewSongBtn.disabled = false;
        saveNewSongBtn.textContent = 'Save New Song';
    }
}



async function searchOnlineSongs(query, currentOrgId)
{
    const supabaseClient = window.getSupabaseClient();
    const resultsTableBody = document.querySelector('#online-search-results-table tbody');
    if (!supabaseClient || !resultsTableBody) return;

    if (!query || query.length < 2)
    {
        resultsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Type at least 2 characters to search...</td></tr>';
        return;
    }

    resultsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Searching...</td></tr>';

    try
    {
        // Search shared songs across all organizations except current
        const { data, error } = await supabaseClient
            .from('songs')
            .select('song_identifier, display_name, chords_content, lyrics_content, is_shared')
            .eq('is_shared', true)
            .neq('organization_id', currentOrgId)
            .ilike('display_name', `%${query}%`)
            .order('display_name', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0)
        {
            resultsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No shared songs found.</td></tr>';
            return;
        }

        resultsTableBody.innerHTML = '';
        data.forEach((song, index) =>
        {
            const row = resultsTableBody.insertRow();
            row.innerHTML = `
                <td>${song.display_name}</td>
                <td class="text-center">Version ${index + 1}</td>
                <td class="text-center">
                    <button class="import-song-btn modal-btn" style="padding: 5px 10px; font-size: 12px;" 
                        data-song='${JSON.stringify(song).replace(/'/g, "&apos;")}'>Add to my Database</button>
                </td>
            `;
        });

    } catch (error)
    {
        console.error('Error searching online songs:', error);
        resultsTableBody.innerHTML = '<tr><td colspan="3" class="text-center" style="color: red;">Error performing search.</td></tr>';
    }
}

async function importSongFromOnline(song, organizationId)
{
    const supabaseClient = window.getSupabaseClient();
    const onlineSearchMsg = document.getElementById('online-search-msg');

    if (!organizationId)
    {
        alert("Please select a church before importing.");
        return;
    }

    try
    {
        // 1. Determine a unique name/identifier for the local database
        let baseDisplayName = song.display_name;
        let baseIdentifier = song.song_identifier;

        // Remove existing version suffix if any (though usually we add it)
        baseDisplayName = baseDisplayName.replace(/\s- v\d+$/, '');

        // Check if a song with this identifier already exists in local DB
        const { data: existingSongs, error: checkError } = await supabaseClient
            .from('songs')
            .select('song_identifier')
            .eq('organization_id', organizationId)
            .ilike('song_identifier', `${baseIdentifier}%`);

        if (checkError) throw checkError;

        let finalDisplayName = baseDisplayName;
        let finalIdentifier = baseIdentifier;

        if (existingSongs && existingSongs.length > 0)
        {
            // If the exact identifier exists, or similar ones, append a version
            // We use the count of matches to determine the version number
            finalDisplayName = `${baseDisplayName} - v${existingSongs.length}`;
            finalIdentifier = `${baseIdentifier}-v${existingSongs.length}`;
        }

        // 2. Insert into local organization
        const { error: insertError } = await supabaseClient.from('songs').insert([{
            organization_id: organizationId,
            song_identifier: finalIdentifier,
            display_name: finalDisplayName,
            chords_content: song.chords_content,
            lyrics_content: song.lyrics_content,
            is_shared: false // Reset sharing for the local copy by default
        }]);

        if (insertError) throw insertError;

        if (onlineSearchMsg)
        {
            onlineSearchMsg.textContent = `"${finalDisplayName}" added to your database!`;
            onlineSearchMsg.style.color = 'green';
        }

        // Refresh song table
        await populateSongDatabaseTable(organizationId);

    } catch (error)
    {
        console.error('Error importing song:', error);
        if (onlineSearchMsg)
        {
            onlineSearchMsg.textContent = `Error: ${error.message}`;
            onlineSearchMsg.style.color = 'red';
        }
    }
}

// Export functions
window.songsModule = {
    populateSongDatabaseTable,
    openEditModal,
    saveSongChanges,
    deleteSong,
    openAddSongModal,
    saveNewSong,
    searchOnlineSongs,
    importSongFromOnline,
    getAllSongsData: () => allSongsData
};
