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

            if (loginModal.style.display === 'block') loginModal.style.display = 'none';
            if (signupModal.style.display === 'block') signupModal.style.display = 'none';
            if (setlistModal.style.display === 'block') setlistModal.style.display = 'none';
            if (editSongModal.style.display === 'block') editSongModal.style.display = 'none';
            if (addSongModal.style.display === 'block') addSongModal.style.display = 'none';
            if (userManagementModal.style.display === 'block') userManagementModal.style.display = 'none';
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
    let targetURL = `${templateURL}?song=${encodeURIComponent(songIdentifier)}&contentType=${encodeURIComponent(contentType)}`;

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
            // "Ensure I cannot delete my profile" -> Hide the button entirely or show text
            let deleteActionHtml = '';
            if (isCurrentUser)
            {
                // Hide button, maybe show text? Or just empty.
                deleteActionHtml = `<span style="color: #999; font-style: italic; font-size: 12px;">N/A</span>`;
            } else if (currentUserIsAdmin)
            {
                deleteActionHtml = `<button class="delete-user-btn" data-user-id="${member.user_id}" aria-label="Remove ${profile.full_name || 'user'}">Remove</button>`;
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

function showUserManagementMessage(message, isError = false)
{
    const userManagementMsg = document.getElementById('user-management-msg');
    userManagementMsg.textContent = message;
    userManagementMsg.style.color = isError ? 'red' : 'green';
    setTimeout(() => { userManagementMsg.textContent = ''; }, 4000);
}

// Export functions
window.uiModule = {
    setupKeyboardNavigation,
    setupSongLinkHandlers,
    handleSongClick,
    populateUserManagementModal,
    showUserManagementMessage
};
