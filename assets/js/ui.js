/**
 * UI Module
 * Handles modal interactions, keyboard navigation, and accessibility
 */

// Debounce search
let searchTimeout;
window.myFunction = function ()
{
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() =>
    {
        var input, filter, table, tr, td, i, txtValue;
        input = document.getElementById("myInput");
        filter = input.value.toUpperCase();
        table = document.getElementById("tabletwo");
        tr = table.getElementsByTagName("tr");
        for (i = 0; i < tr.length; i++)
        {
            td = tr[i].getElementsByTagName("td")[0];
            if (td)
            {
                txtValue = td.textContent || td.innerText;
                tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
        }
    }, 300); // 300ms debounce delay
};

// Keyboard navigation - Close modals with Escape
function setupKeyboardNavigation()
{
    document.addEventListener('keydown', (e) =>
    {
        if (e.key === 'Escape')
        {
            const loginModal = document.getElementById('login-modal');
            const signupModal = document.getElementById('signup-modal');
            const setlistModal = document.getElementById('setlist-modal');
            const editSongModal = document.getElementById('edit-song-modal');
            const addSongModal = document.getElementById('add-song-modal');
            const userManagementModal = document.getElementById('user-management-modal');
            const searchOnlineModal = document.getElementById('search-online-modal');
            const legalModal = document.getElementById('legal-modal');

            if (loginModal.style.display === 'block') loginModal.style.display = 'none';
            if (signupModal.style.display === 'block') signupModal.style.display = 'none';
            if (setlistModal.style.display === 'block') setlistModal.style.display = 'none';
            if (editSongModal.style.display === 'block') editSongModal.style.display = 'none';
            if (addSongModal.style.display === 'block') addSongModal.style.display = 'none';
            if (userManagementModal.style.display === 'block') userManagementModal.style.display = 'none';
            if (searchOnlineModal.style.display === 'block') searchOnlineModal.style.display = 'none';
            if (legalModal && legalModal.style.display === 'block') legalModal.style.display = 'none';
        }
    });
}

// Handle delegated click for song links
function setupSongLinkHandlers()
{
    document.body.addEventListener('click', (event) =>
    {
        const songLink = event.target.closest('a[data-song-identifier]');
        const editLink = event.target.closest('a.edit-btn');
        const currentUserRole = window.authModule.getCurrentUserRole();
        const role = currentUserRole ? String(currentUserRole).toLowerCase() : '';

        if (editLink && (role === 'admin' || role === 'user'))
        {
            event.preventDefault();
            window.songsModule.openEditModal(editLink.dataset.songIdentifier, editLink.dataset.displayName);
        }
        else if (songLink)
        {
            event.preventDefault();
            handleSongClick(event, songLink);
        }
    });
}

async function handleSongClick(event, linkElement)
{
    event.preventDefault();
    const songIdentifier = linkElement.dataset.songIdentifier;
    const contentType = linkElement.dataset.contentType;
    if (!songIdentifier || !contentType) return;

    const templateURL = "./assets/master/template.html";
    let targetURL = `${templateURL}?song=${encodeURIComponent(songIdentifier)}&contentType=${encodeURIComponent(contentType)}&org=${encodeURIComponent(window.activeOrganizationId)}`;

    if (contentType === 'lyrics')
    {
        targetURL += `&hideTranspose=true`;
    }
    else if (contentType === 'chords')
    {
        // Check if this song is in the setlist and get the target key
        const currentSetlist = window.setlistModule ? window.setlistModule.getCurrentSetlist() : [];
        const setlistItem = currentSetlist.find(item => item.songName === songIdentifier);
        if (setlistItem && setlistItem.key)
        {
            targetURL += `&targetKey=${encodeURIComponent(setlistItem.key)}`;
        }
    }

    window.location.href = targetURL;
}

// User Management Modal functions
async function populateUserManagementModal()
{
    const supabaseClient = window.getSupabaseClient();
    const userListTableBody = document.querySelector('#user-list-table tbody');
    const orgId = window.activeOrganizationId;

    if (!orgId)
    {
        userListTableBody.innerHTML = '<tr><td colspan="3">No active organization.</td></tr>';
        return;
    }

    userListTableBody.innerHTML = '<tr><td colspan="3">Loading users...</td></tr>';
    try
    {
        // Step 1: Fetch members (IDs and roles)
        const { data: members, error: membersError } = await supabaseClient
            .from('organization_members')
            .select('user_id, role')
            .eq('organization_id', orgId);

        if (membersError) throw membersError;

        if (!members || members.length === 0)
        {
            userListTableBody.innerHTML = '<tr><td colspan="3">No users found</td></tr>';
            return;
        }

        // Step 2: Fetch profiles for these users manually (Application-side Join)
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Create a lookup map
        const profileMap = {};
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });

        userListTableBody.innerHTML = '';
        const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
        const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
        const currentUserIsAdmin = !!(currentUserRole && String(currentUserRole).toLowerCase() === 'admin');

        console.log(`UserMgmt: Found ${members.length} members. Admin: ${currentUserIsAdmin}`);

        // Prepare data for sorting
        const memberRows = members.map(member =>
        {
            const profile = profileMap[member.user_id] || { full_name: 'Unknown', email: 'Unknown' };
            let nameForSort = profile.full_name || profile.email || 'zzzz';
            return { member, profile, nameForSort: nameForSort.toLowerCase() };
        });

        // Sort alphabetically
        memberRows.sort((a, b) => a.nameForSort.localeCompare(b.nameForSort));

        memberRows.forEach(item =>
        {
            const { member, profile } = item;
            const isCurrentUser = member.user_id === currentUser?.id;

            let displayName = profile.full_name || profile.email || 'N/A';
            if (profile.full_name && profile.email)
            {
                displayName = `${profile.full_name} <span class="user-email-hint">(${profile.email})</span>`;
            }

            if (isCurrentUser)
            {
                displayName += ` <span style="font-weight: bold; color: #4CAF50; margin-left: 5px;">(You)</span>`;
            }

            // Roles Logic: Current user cannot change their own role here to prevent accidents? 
            // Usually you can't demote yourself if you are the only admin. 
            // But let's allow it if the logic permits.

            // Delete Button Logic:
            let deleteActionHtml = '';
            if (isCurrentUser)
            {
                deleteActionHtml = `<span style="color: #999; font-style: italic; font-size: 12px; display: inline-block; min-width: 60px; text-align: center;">N/A</span>`;
            } else if (currentUserIsAdmin)
            {
                // Use a clean label without any HTML to avoid breaking the attribute
                const cleanLabel = (profile.full_name || profile.email || 'user').replace(/"/g, '&quot;');
                deleteActionHtml = `<button class="delete-user-btn" data-user-id="${member.user_id}" aria-label="Remove ${cleanLabel}">Remove</button>`;
            } else
            {
                deleteActionHtml = `<span style="color: #ccc;">-</span>`;
            }

            const row = userListTableBody.insertRow();
            row.innerHTML = `
                <td>${displayName}</td>
                <td>
                    <select class="role-select" data-user-id="${member.user_id}" aria-label="Role" ${isCurrentUser ? 'disabled' : ''}>
                        <option value="User" ${member.role && member.role.toLowerCase() === 'user' ? 'selected' : ''}>User</option>
                        <option value="Admin" ${member.role && member.role.toLowerCase() === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    ${deleteActionHtml}
                </td>
            `;
        });



    } catch (error)
    {
        userListTableBody.innerHTML = `<tr><td colspan="3">Error loading users: ${error.message}</td></tr>`;
        console.error("Error fetching user list:", error);
    }
}

function setupOnlineSearchHandlers()
{
    const onlineSearchInput = document.getElementById('online-search-input');
    const onlineSearchModal = document.getElementById('search-online-modal');
    const resultsTable = document.getElementById('online-search-results-table');

    if (!onlineSearchInput || !onlineSearchModal || !resultsTable) return;

    let onlineSearchTimeout;
    onlineSearchInput.addEventListener('input', () =>
    {
        clearTimeout(onlineSearchTimeout);
        onlineSearchTimeout = setTimeout(() =>
        {
            const query = onlineSearchInput.value.trim();
            const currentOrgId = window.activeOrganizationId;
            window.songsModule.searchOnlineSongs(query, currentOrgId);
        }, 500);
    });

    resultsTable.addEventListener('click', async (event) =>
    {
        const importBtn = event.target.closest('.import-song-btn');
        if (importBtn)
        {
            const songData = JSON.parse(importBtn.dataset.song);
            const currentOrgId = window.activeOrganizationId;
            importBtn.disabled = true;
            importBtn.textContent = 'Importing...';
            await window.songsModule.importSongFromOnline(songData, currentOrgId);
            importBtn.textContent = 'Added!';
        }
    });

    // Close buttons
    const closeBtn = onlineSearchModal.querySelector('.close-search-online-modal-btn');
    if (closeBtn)
    {
        closeBtn.onclick = () => { onlineSearchModal.style.display = 'none'; };
    }
}

function showUserManagementMessage(message, isError = false)
{
    const userManagementMsg = document.getElementById('user-management-msg');
    userManagementMsg.textContent = message;
    userManagementMsg.style.color = isError ? 'red' : 'green';
    setTimeout(() => { userManagementMsg.textContent = ''; }, 4000);
}

function openLegalModal(tab = 'terms')
{
    const modal = document.getElementById('legal-modal');
    if (!modal) return;
    modal.style.display = 'block';
    switchLegalTab(tab);
}

function switchLegalTab(tab)
{
    const tabTerms = document.getElementById('tab-terms');
    const tabPrivacy = document.getElementById('tab-privacy');
    const contentTerms = document.getElementById('content-terms');
    const contentPrivacy = document.getElementById('content-privacy');

    if (!tabTerms || !tabPrivacy) return;

    if (tab === 'terms')
    {
        tabTerms.classList.add('active');
        tabTerms.style.borderBottom = '3px solid #4CAF50';
        tabPrivacy.classList.remove('active');
        tabPrivacy.style.borderBottom = 'none';
        tabPrivacy.style.color = '#666';
        contentTerms.style.display = 'block';
        contentPrivacy.style.display = 'none';
    } else
    {
        tabPrivacy.classList.add('active');
        tabPrivacy.style.borderBottom = '3px solid #4CAF50';
        tabTerms.classList.remove('active');
        tabTerms.style.borderBottom = 'none';
        tabTerms.style.color = '#666';
        contentPrivacy.style.display = 'block';
        contentTerms.style.display = 'none';
    }
}

function setupLegalHandlers()
{
    // Tagged buttons/links
    document.querySelectorAll('.open-legal-btn').forEach(btn =>
    {
        btn.onclick = (e) =>
        {
            e.preventDefault();
            const tab = btn.textContent.toLowerCase().includes('privacy') ? 'privacy' : 'terms';
            openLegalModal(tab);
        };
    });

    // Close buttons
    document.querySelectorAll('.close-legal-modal-btn').forEach(btn =>
    {
        btn.onclick = () => { document.getElementById('legal-modal').style.display = 'none'; };
    });

    // Tab switching
    document.getElementById('tab-terms')?.addEventListener('click', () => switchLegalTab('terms'));
    document.getElementById('tab-privacy')?.addEventListener('click', () => switchLegalTab('privacy'));
}

// Export functions
window.uiModule = {
    setupKeyboardNavigation,
    setupSongLinkHandlers,
    setupOnlineSearchHandlers,
    handleSongClick,
    populateUserManagementModal,
    showUserManagementMessage,
    openLegalModal,
    setupLegalHandlers
};
