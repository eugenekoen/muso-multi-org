/**
 * Application Initialization
 * Sets up all event listeners and initializes the app
 */

document.addEventListener('DOMContentLoaded', () =>
{
    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient)
    {
        alert("Supabase configuration is missing. App cannot load data.");
        return;
    }

    // Initialize modules
    window.uiModule.setupKeyboardNavigation();
    window.uiModule.setupSongLinkHandlers();

    // Data loading (songs, setlists) is now DEFERRED until valid user & org are confirmed.
    // See initializeOrganizationState in organization.js

    // DOM Elements
    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const setlistModal = document.getElementById('setlist-modal');
    const editSongModal = document.getElementById('edit-song-modal');
    const addSongModal = document.getElementById('add-song-modal');
    const userManagementModal = document.getElementById('user-management-modal');
    const organizationModal = document.getElementById('organization-modal'); // New Modal

    const loginModalBtn = document.getElementById('login-modal-btn');
    const signupModalBtn = document.getElementById('signup-modal-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginBtn = document.getElementById('login-btn');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const signupBtn = document.getElementById('signup-btn');
    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupMsg = document.getElementById('signup-msg');

    // New Organization Modal Elements
    const switchChurchBtn = document.getElementById('switch-church-btn');
    const joinOrgBtn = document.getElementById('join-org-btn');
    const organizationList = document.getElementById('organization-list');

    const manageSetlistBtn = document.getElementById('manage-setlist-btn');
    const addSongBtnTrigger = document.getElementById('add-song-btn');
    const userManagementBtn = document.getElementById('user-management-btn');
    const userListTableBody = document.querySelector('#user-list-table tbody');

    const songSearchInput = document.getElementById('song-search-input');
    const keySelectDropdown = document.getElementById('key-select-dropdown');
    const addSongToSetlistBtn = document.getElementById('add-song-to-setlist-btn');
    const selectedSongIdentifierInput = document.getElementById('selected-song-identifier');
    const selectedSongDisplayNameInput = document.getElementById('selected-song-display-name');
    const songSearchResultsContainer = document.getElementById('song-search-results');
    const resultsListDiv = songSearchResultsContainer?.querySelector('.results-list');
    const currentSetlistItemsUl = document.getElementById('current-setlist-items');

    // --- AUTH LISTENERS ---
    loginModalBtn.addEventListener('click', () =>
    {
        loginErrorMsg.textContent = '';
        loginModal.style.display = 'block';
    });

    signupModalBtn.addEventListener('click', () =>
    {
        signupMsg.textContent = '';
        signupModal.style.display = 'block';
    });

    logoutBtn.addEventListener('click', async () =>
    {
        // 1. Instant Feedback
        logoutBtn.textContent = 'Logging out...';
        logoutBtn.disabled = true;

        const supabaseClient = window.getSupabaseClient();
        let signOutError = null;

        // 2. Trigger Sign Out and wait for it to complete
        try
        {
            const result = await window.authModule.signOut();
            if (result && result.error) signOutError = result.error;
        } catch (err)
        {
            signOutError = err;
            console.error('Error during signOut:', err);
        }

        // 3. Clear Local State Immediately
        localStorage.removeItem('activeOrganizationId');
        localStorage.removeItem('activeOrganizationName');
        window.activeOrganizationId = null;

        // 4. Update UI immediately to logged-out state and clear songs/setlist
        try
        {
            window.authModule.updateAuthState(null);
            if (window.songsModule && window.songsModule.populateSongDatabaseTable)
            {
                window.songsModule.populateSongDatabaseTable(null);
            }
            if (window.setlistModule && window.setlistModule.loadSetlistFromSupabase)
            {
                window.setlistModule.loadSetlistFromSupabase(null);
            }

            // Ensure primary buttons visibility matches logged-out state
            const loginModalBtn = document.getElementById('login-modal-btn');
            const signupModalBtn = document.getElementById('signup-modal-btn');
            const switchChurchBtn = document.getElementById('switch-church-btn');
            const manageSetlistBtn = document.getElementById('manage-setlist-btn');
            const addSongBtnTrigger = document.getElementById('add-song-btn');
            const userManagementBtn = document.getElementById('user-management-btn');
            const logoutBtnEl = document.getElementById('logout-btn');

            if (loginModalBtn) loginModalBtn.style.display = 'inline-block';
            if (signupModalBtn) signupModalBtn.style.display = 'inline-block';
            if (switchChurchBtn) switchChurchBtn.style.display = 'none';
            if (manageSetlistBtn) manageSetlistBtn.style.display = 'none';
            if (addSongBtnTrigger) addSongBtnTrigger.style.display = 'none';
            if (userManagementBtn) userManagementBtn.style.display = 'none';
            if (logoutBtnEl) logoutBtnEl.style.display = 'none';
        } catch (err)
        {
            console.error('Error updating UI after signOut:', err);
        }

        // 5. Restore button state locally (no forced reload)
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Logout';

        if (signOutError)
        {
            console.warn('Sign out reported an error:', signOutError);
        }
    });

    loginBtn.addEventListener('click', async () =>
    {
        loginErrorMsg.textContent = '';
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password)
        {
            loginErrorMsg.textContent = 'Please enter email and password.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try
        {
            const { data, error } = await window.authModule.signInWithEmail(email, password);
            if (error)
            {
                loginErrorMsg.textContent = error.message;
            } else
            {
                // Success! Close modal and clear password
                loginModal.style.display = 'none';
                loginPasswordInput.value = '';
                // The onAuthStateChange handler will update the UI
            }
        } catch (err)
        {
            loginErrorMsg.textContent = 'An unexpected error occurred.';
            console.error('Login error:', err);
        } finally
        {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    });

    loginPasswordInput.addEventListener('keyup', e => e.key === 'Enter' && loginBtn.click());

    signupBtn.addEventListener('click', async () =>
    {
        signupMsg.textContent = '';
        signupMsg.classList.remove('success');

        const name = signupNameInput.value;
        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;

        if (!name || !email || !password)
        {
            signupMsg.textContent = 'Please fill out all fields.';
            return;
        }

        // This function is now simpler and doesn't need an org code
        const { data, error } = await window.authModule.signUpUser(name, email, password);

        if (error)
        {
            signupMsg.textContent = error.message;
        } else
        {
            signupMsg.textContent = "Success! Please check your email to confirm your account, then you can log in.";
            signupMsg.classList.add('success');
            signupNameInput.value = '';
            signupEmailInput.value = '';
            signupPasswordInput.value = '';
            setTimeout(() =>
            {
                // Close signup and automatically open login for convenience
                signupModal.style.display = 'none';
                signupMsg.textContent = '';
                signupMsg.classList.remove('success');
            }, 5000);
        }
    });

    signupPasswordInput.addEventListener('keyup', e => e.key === 'Enter' && signupBtn.click());

    // --- SONG LISTENERS ---
    addSongBtnTrigger.addEventListener('click', () =>
    {
        window.songsModule.openAddSongModal(window.activeOrganizationId);
    });

    document.getElementById('save-new-song-btn').addEventListener('click', () =>
    {
        window.songsModule.saveNewSong(window.activeOrganizationId);
    });

    document.getElementById('cancel-add-btn').addEventListener('click', () =>
    {
        addSongModal.style.display = 'none';
    });

    document.getElementById('save-song-btn').addEventListener('click', () =>
    {
        window.songsModule.saveSongChanges();
    });

    document.getElementById('delete-song-btn').addEventListener('click', () =>
    {
        window.songsModule.deleteSong();
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', () =>
    {
        editSongModal.style.display = 'none';
    });

    // --- SETLIST LISTENERS ---
    manageSetlistBtn.addEventListener('click', () =>
    {
        setlistModal.style.display = 'block';
        window.setlistModule.renderSetlistUI();
    });

    // Song search in setlist modal
    if (songSearchInput)
    {
        songSearchInput.addEventListener('input', () =>
        {
            const searchTerm = songSearchInput.value.trim().toLowerCase();
            resultsListDiv.innerHTML = '';
            selectedSongIdentifierInput.value = '';
            selectedSongDisplayNameInput.value = '';
            if (searchTerm.length < 1)
            {
                resultsListDiv.style.display = 'none';
                return;
            }
            const allSongs = window.songsModule.getAllSongsData();
            const matchedSongs = allSongs.filter(song => song.displayName.toLowerCase().includes(searchTerm));
            if (matchedSongs.length > 0)
            {
                matchedSongs.forEach(song =>
                {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'result-item';
                    itemDiv.textContent = song.displayName;
                    itemDiv.addEventListener('click', () =>
                    {
                        songSearchInput.value = song.displayName;
                        selectedSongIdentifierInput.value = song.identifier;
                        selectedSongDisplayNameInput.value = song.displayName;
                        resultsListDiv.style.display = 'none';
                    });
                    resultsListDiv.appendChild(itemDiv);
                });
                resultsListDiv.style.display = 'block';
            } else
            {
                resultsListDiv.style.display = 'none';
            }
        });
    }

    // Add song to setlist
    if (addSongToSetlistBtn)
    {
        addSongToSetlistBtn.addEventListener('click', async () =>
        {
            const songFileIdentifier = selectedSongIdentifierInput.value;
            const displayName = selectedSongDisplayNameInput.value;
            if (!songFileIdentifier || !displayName)
            {
                alert('Please search for a song and select it from the list.');
                return;
            }
            await window.setlistModule.addSongToSetlist(songFileIdentifier, displayName, keySelectDropdown.value);
        });
    }

    // Setlist item listeners
    if (currentSetlistItemsUl)
    {
        currentSetlistItemsUl.addEventListener('click', async (event) =>
        {
            if (event.target.classList.contains('remove-song-btn'))
            {
                const indexToRemove = parseInt(event.target.dataset.index, 10);
                let setlist = window.setlistModule.getCurrentSetlist();
                setlist.splice(indexToRemove, 1);
                window.setlistModule.setCurrentSetlist(setlist);
                window.setlistModule.renderSetlistUI();
                await window.setlistModule.saveSetlistToSupabase();
            }
        });

        // Drag and drop for setlist reordering
        const getDragAfterElement = (container, y) =>
        {
            const draggableElements = [...container.querySelectorAll('li[draggable="true"]:not(.dragging)')];
            return draggableElements.reduce((closest, child) =>
            {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset)
                {
                    return { offset: offset, element: child };
                } else
                {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };

        currentSetlistItemsUl.addEventListener('dragstart', e =>
        {
            const listItem = e.target.closest('li[draggable="true"]');
            if (listItem)
            {
                setTimeout(() => { listItem.classList.add('dragging'); }, 0);
            }
        });

        currentSetlistItemsUl.addEventListener('dragover', e =>
        {
            e.preventDefault();
            const afterElement = getDragAfterElement(currentSetlistItemsUl, e.clientY);
            const draggingElement = currentSetlistItemsUl.querySelector('.dragging');
            if (draggingElement)
            {
                if (afterElement == null)
                {
                    currentSetlistItemsUl.appendChild(draggingElement);
                } else
                {
                    currentSetlistItemsUl.insertBefore(draggingElement, afterElement);
                }
            }
        });

        currentSetlistItemsUl.addEventListener('dragend', async (e) =>
        {
            const draggingElement = currentSetlistItemsUl.querySelector('.dragging');
            if (draggingElement)
            {
                draggingElement.classList.remove('dragging');
                const newOrderedIndices = Array.from(currentSetlistItemsUl.querySelectorAll('li')).map(li => parseInt(li.dataset.index));
                let currentSetlist = window.setlistModule.getCurrentSetlist();
                const newOrderedSetlist = newOrderedIndices.map(originalIndex => currentSetlist[originalIndex]);
                window.setlistModule.setCurrentSetlist(newOrderedSetlist);
                window.setlistModule.renderSetlistUI();
                await window.setlistModule.saveSetlistToSupabase();
            }
        });
    }

    // --- USER MANAGEMENT LISTENERS ---
    userManagementBtn.addEventListener('click', () =>
    {
        userManagementModal.style.display = 'block';
        window.uiModule.populateUserManagementModal();
    });

    userListTableBody.addEventListener('change', async (event) =>
    {
        if (event.target.classList.contains('role-select'))
        {
            const userId = event.target.dataset.userId;
            const newRole = event.target.value;

            if (!window.activeOrganizationId)
            {
                window.uiModule.showUserManagementMessage('No active organization selected', true);
                return;
            }

            const { error } = await supabaseClient
                .from('organization_members')
                .update({ role: newRole })
                .eq('organization_id', window.activeOrganizationId)
                .eq('user_id', userId);

            if (error)
            {
                window.uiModule.showUserManagementMessage(`Error updating role: ${error.message}`, true);
            } else
            {
                window.uiModule.showUserManagementMessage(`Successfully updated role.`);
            }
        }
    });

    // Handle delete user actions (Admin only)
    userListTableBody.addEventListener('click', async (event) =>
    {
        if (event.target.classList.contains('delete-user-btn'))
        {
            const userId = event.target.dataset.userId;
            const label = event.target.getAttribute('aria-label') || 'this user';

            if (!confirm(`Are you sure you want to delete ${label}? This will remove their profile record.`)) return;

            const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
            const { data: { user: currentUser } } = await supabaseClient.auth.getUser();

            if (userId === currentUser?.id)
            {
                window.uiModule.showUserManagementMessage('You cannot delete your own account from here.', true);
                return;
            }

            if (currentUserRole !== 'Admin')
            {
                window.uiModule.showUserManagementMessage('Only admins can remove users.', true);
                return;
            }

            if (!window.activeOrganizationId)
            {
                window.uiModule.showUserManagementMessage('No active organization.', true);
                return;
            }

            const { error } = await supabaseClient
                .from('organization_members')
                .delete()
                .eq('user_id', userId)
                .eq('organization_id', window.activeOrganizationId);

            if (error)
            {
                window.uiModule.showUserManagementMessage(`Error removing user: ${error.message}`, true);
            } else
            {
                window.uiModule.showUserManagementMessage('User removed from church.');
                await window.uiModule.populateUserManagementModal();
            }
        }
    });

    // --- MODAL CLOSE LISTENERS ---
    document.querySelector('.close-login-modal-btn').addEventListener('click', () => loginModal.style.display = 'none');
    document.querySelector('.close-signup-modal-btn').addEventListener('click', () => signupModal.style.display = 'none');
    document.querySelector('.close-edit-modal-btn').addEventListener('click', () => editSongModal.style.display = 'none');
    document.querySelector('.close-add-modal-btn').addEventListener('click', () => addSongModal.style.display = 'none');
    document.querySelector('.close-user-management-modal-btn').addEventListener('click', () => userManagementModal.style.display = 'none');

    const closeSetlistModalBtn = setlistModal?.querySelector('.close-modal-btn');
    if (closeSetlistModalBtn)
    {
        closeSetlistModalBtn.addEventListener('click', () =>
        {
            setlistModal.style.display = 'none';
            window.setlistModule.updateTableOneWithSetlist();
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (event) =>
    {
        if (event.target == loginModal) loginModal.style.display = 'none';
        if (event.target == signupModal) signupModal.style.display = 'none';
        if (event.target == setlistModal)
        {
            setlistModal.style.display = 'none';
            window.setlistModule.updateTableOneWithSetlist();
        }
        if (event.target == userManagementModal) userManagementModal.style.display = 'none';
    });

    // --- NEW ORGANIZATION LISTENERS ---
    if (switchChurchBtn)
    {
        switchChurchBtn.addEventListener('click', () =>
        {
            window.organizationModule.openOrganizationModal();
        });
    }

    if (joinOrgBtn)
    {
        joinOrgBtn.addEventListener('click', async () =>
        {
            await window.organizationModule.joinOrganization();
        });
    }

    if (organizationList)
    {
        organizationList.addEventListener('click', (event) =>
        {
            const target = event.target.closest('.switch-org-btn');
            if (target)
            {
                const orgId = target.dataset.orgId;
                window.organizationModule.setActiveOrganization(orgId);
            }
        });
    }

    document.getElementById('close-org-modal-btn')?.addEventListener('click', () => organizationModal.style.display = 'none');
    window.addEventListener('click', (event) =>
    {
        if (event.target == organizationModal) organizationModal.style.display = 'none';
    });

    // --- AUTH STATE CHANGE ---
    let lastSessionUserId = null;

    supabaseClient.auth.onAuthStateChange(async (event, session) =>
    {
        const currentUserId = session?.user?.id;
        console.log('Auth state changed:', event, currentUserId);

        // Optimization: duplicate events often fire (INITIAL_SESSION then SIGNED_IN)
        // If we are already handling this user, don't spam initialization.
        // Exception: SIGNED_OUT needs to be handled always.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
        {
            if (lastSessionUserId === currentUserId)
            {
                console.log("Skipping redundant init for same user");
                return;
            }
        }

        lastSessionUserId = currentUserId;

        // 1. Update visual Auth State (buttons, etc.)
        window.authModule.updateAuthState(session?.user);

        // 2. Initialize Organization State
        await window.organizationModule.initializeOrganizationState(session?.user);
    });

    // Handle Back/Forward Cache (bfcache) navigation
    window.addEventListener('pageshow', async (event) =>
    {
        // Only refresh if truly needed. 
        // If we have an active org and user, we probably don't need to do anything as the DOM is living.
        if (event.persisted)
        {
            console.log('Page restored from bfcache');
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user)
            {
                // Check if we lost state
                if (!window.activeOrganizationId)
                {
                    console.log('Bfcache restore: State lost, refreshing...');
                    window.authModule.updateAuthState(session.user);
                    await window.organizationModule.initializeOrganizationState(session.user);
                } else
                {
                    console.log('Bfcache restore: State appears intact, skipping refresh.');
                }
            }
        }
    });
});
