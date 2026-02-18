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

    // Landing Page and Dashboard Elements
    const landingPage = document.getElementById('landing-page');
    const dashboard = document.getElementById('dashboard');
    const heroSignupBtn = document.getElementById('hero-signup-btn');
    const heroLoginBtn = document.getElementById('hero-login-btn');
    const navOrgName = document.getElementById('nav-org-name');
    const navUserRole = document.getElementById('nav-user-role');

    // Initialize - show landing page by default
    landingPage.style.display = 'block';
    dashboard.style.display = 'none';

    // Hero button click handlers
    if (heroSignupBtn)
    {
        heroSignupBtn.addEventListener('click', () =>
        {
            document.getElementById('signup-modal-btn').click();
        });
    }

    if (heroLoginBtn)
    {
        heroLoginBtn.addEventListener('click', () =>
        {
            document.getElementById('login-modal-btn').click();
        });
    }

    // Function to toggle between landing page and dashboard
    window.toggleAppView = function (isLoggedIn)
    {
        if (isLoggedIn)
        {
            landingPage.style.display = 'none';
            dashboard.style.display = 'block';
            document.body.classList.add('logged-in');
        } else
        {
            landingPage.style.display = 'block';
            dashboard.style.display = 'none';
            document.body.classList.remove('logged-in');
        }
    };

    // Function to update nav bar info
    window.updateNavInfo = function (orgName, roleName)
    {
        if (navOrgName) navOrgName.textContent = orgName || 'No Church Selected';
        if (navUserRole) navUserRole.textContent = roleName || 'Member';
    };

    // Function to update nav brand title with church name and hide subtitle
    window.updateNavBrand = function (churchName)
    {
        const navBrandTitle = document.querySelector('.nav-brand-title');
        const navBrandSubtitle = document.querySelector('.nav-brand-subtitle');

        if (navBrandTitle)
        {
            if (churchName)
            {
                navBrandTitle.textContent = churchName;
                // Hide the subtitle when a church is selected
                if (navBrandSubtitle)
                {
                    navBrandSubtitle.style.display = 'none';
                }
            } else
            {
                navBrandTitle.textContent = 'Music In His Name';
                // Show the subtitle when no church is selected
                if (navBrandSubtitle)
                {
                    navBrandSubtitle.style.display = 'block';
                }
            }
        }
    };

    // Initialize modules
    window.uiModule.setupKeyboardNavigation();
    window.uiModule.setupSongLinkHandlers();
    window.uiModule.setupOnlineSearchHandlers();
    window.uiModule.setupLegalHandlers();
    window.uiModule.setupConnectionStatusToast();

    // Data loading (songs, setlists) is now DEFERRED until valid user & org are confirmed.
    // See initializeOrganizationState in organization.js

    // DOM Elements
    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const setlistModal = document.getElementById('setlist-modal');
    const editSongModal = document.getElementById('edit-song-modal');
    const addSongModal = document.getElementById('add-song-modal');
    const userManagementModal = document.getElementById('user-management-modal');
    const organizationModal = document.getElementById('organization-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const resetPasswordModal = document.getElementById('reset-password-modal');

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
    const searchOnlineBtnTrigger = document.getElementById('search-online-btn');
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
        // 1. Instant Feedback & Clear Local State
        logoutBtn.textContent = 'Logging out...';
        logoutBtn.disabled = true;

        const supabaseClient = window.getSupabaseClient();

        // --- MOVED UP: Clear UI Immediately ---
        // 2. Clear Local State & UI Immediately
        localStorage.clear(); // FULL CLEAR as requested
        window.activeOrganizationId = null;

        try
        {
            window.authModule.updateAuthState(null);
            if (window.organizationModule && window.organizationModule.clearOrganizationState)
            {
                window.organizationModule.clearOrganizationState();
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
            if (searchOnlineBtnTrigger) searchOnlineBtnTrigger.style.display = 'none';
            if (userManagementBtn) userManagementBtn.style.display = 'none';
            if (logoutBtnEl) logoutBtnEl.style.display = 'none';
        } catch (err)
        {
            console.error('Error updating UI after signOut:', err);
        }

        // 3. Trigger Sign Out (Backend) - Wait for it but UI is already clear
        let signOutError = null;
        try
        {
            const result = await window.authModule.signOut();
            if (result && result.error) signOutError = result.error;
        } catch (err)
        {
            signOutError = err;
            console.error('Error during signOut:', err);
        }

        // 4. Restore button state (Optional, since button is usually hidden now)
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

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordEmailInput = document.getElementById('forgot-password-email');
    const sendResetEmailBtn = document.getElementById('send-reset-email-btn');
    const forgotPasswordMsg = document.getElementById('forgot-password-msg');

    forgotPasswordLink.addEventListener('click', (e) =>
    {
        e.preventDefault();
        loginModal.style.display = 'none';
        forgotPasswordMsg.textContent = '';
        forgotPasswordModal.style.display = 'block';
    });

    sendResetEmailBtn.addEventListener('click', async () =>
    {
        const email = forgotPasswordEmailInput.value.trim();
        if (!email)
        {
            forgotPasswordMsg.textContent = 'Please enter your email.';
            forgotPasswordMsg.style.color = 'red';
            return;
        }

        sendResetEmailBtn.disabled = true;
        sendResetEmailBtn.textContent = 'Sending...';

        try
        {
            const { error } = await window.authModule.sendResetPasswordEmail(email);
            if (error)
            {
                forgotPasswordMsg.textContent = error.message;
                forgotPasswordMsg.style.color = 'red';
            } else
            {
                forgotPasswordMsg.textContent = 'Check your email for the reset link!';
                forgotPasswordMsg.style.color = 'green';
                setTimeout(() =>
                {
                    forgotPasswordModal.style.display = 'none';
                }, 3000);
            }
        } catch (err)
        {
            forgotPasswordMsg.textContent = 'An unexpected error occurred.';
            forgotPasswordMsg.style.color = 'red';
        } finally
        {
            sendResetEmailBtn.disabled = false;
            sendResetEmailBtn.textContent = 'Send Reset Link';
        }
    });

    const updatePasswordBtn = document.getElementById('update-password-btn');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const resetPasswordMsg = document.getElementById('reset-password-msg');

    updatePasswordBtn.addEventListener('click', async () =>
    {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!newPassword || newPassword.length < 6)
        {
            resetPasswordMsg.textContent = 'Password must be at least 6 characters.';
            resetPasswordMsg.style.color = 'red';
            return;
        }

        if (newPassword !== confirmPassword)
        {
            resetPasswordMsg.textContent = 'Passwords do not match.';
            resetPasswordMsg.style.color = 'red';
            return;
        }

        updatePasswordBtn.disabled = true;
        updatePasswordBtn.textContent = 'Updating...';

        try
        {
            const { error } = await window.authModule.updatePassword(newPassword);
            if (error)
            {
                resetPasswordMsg.textContent = error.message;
                resetPasswordMsg.style.color = 'red';
            } else
            {
                resetPasswordMsg.textContent = 'Password updated successfully! Redirecting...';
                resetPasswordMsg.style.color = 'green';
                setTimeout(() =>
                {
                    resetPasswordModal.style.display = 'none';
                    // Clear fields
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                    // Optionally force refresh or just let auth state handle it
                }, 2000);
            }
        } catch (err)
        {
            resetPasswordMsg.textContent = 'An unexpected error occurred.';
            resetPasswordMsg.style.color = 'red';
        } finally
        {
            updatePasswordBtn.disabled = false;
            updatePasswordBtn.textContent = 'Update Password';
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

        // Disable button to prevent multiple clicks
        signupBtn.disabled = true;
        const originalText = signupBtn.textContent;
        signupBtn.textContent = 'Signing up...';

        // This function is now simpler and doesn't need an org code
        const { data, error } = await window.authModule.signUpUser(name, email, password);

        // Re-enable button after attempt
        signupBtn.disabled = false;
        signupBtn.textContent = originalText;

        console.log('Signup result:', { hasData: !!data, hasError: !!error, errorMsg: error?.message });

        if (error)
        {
            signupMsg.textContent = error.message;
            signupMsg.style.color = 'red';
        } else
        {
            // Check if user needs to confirm email or was auto-confirmed
            const needsEmailConfirmation = data.user && !data.user.confirmed_at;

            if (needsEmailConfirmation)
            {
                signupMsg.textContent = "Successfully signed up! Check your email to confirm your account.";
            } else
            {
                signupMsg.textContent = "Successfully signed up! You can now log in.";
            }

            signupMsg.classList.add('success');
            signupMsg.style.color = 'green';
            signupNameInput.value = '';
            signupEmailInput.value = '';
            signupPasswordInput.value = '';
            setTimeout(() =>
            {
                // Close signup modal
                signupModal.style.display = 'none';
                signupMsg.textContent = '';
                signupMsg.classList.remove('success');
            }, 3000);
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

    // --- SEARCH ONLINE LISTENERS ---
    if (searchOnlineBtnTrigger)
    {
        searchOnlineBtnTrigger.addEventListener('click', () =>
        {
            document.getElementById('search-online-modal').style.display = 'block';
        });
    }

    // --- SETLIST LISTENERS ---
    manageSetlistBtn.addEventListener('click', () =>
    {
        setlistModal.style.display = 'block';
        window.setlistModule.renderSetlistUI();
    });

    // Song search in setlist modal
    let setlistSearchTimeout;
    if (songSearchInput)
    {
        songSearchInput.addEventListener('input', () =>
        {
            clearTimeout(setlistSearchTimeout);
            setlistSearchTimeout = setTimeout(() =>
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
            }, 300); // 300ms debounce
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

    // --- KEY MANAGER LISTENERS ---
    const keyManagerBtn = document.getElementById('key-manager-btn');
    const keyManagerModal = document.getElementById('key-manager-modal');
    const orgManagementTableBody = document.querySelector('#org-management-table tbody');

    if (keyManagerBtn)
    {
        keyManagerBtn.addEventListener('click', () =>
        {
            keyManagerModal.style.display = 'block';
            window.keyManagerModule.populateKeyManagerModal();
        });
    }

    document.getElementById('save-new-org-btn')?.addEventListener('click', () =>
    {
        window.keyManagerModule.saveNewOrganization();
    });

    if (orgManagementTableBody)
    {
        orgManagementTableBody.addEventListener('click', async (event) =>
        {
            const target = event.target;
            const orgId = target.dataset.orgId;

            if (target.classList.contains('update-org-code-btn'))
            {
                const input = orgManagementTableBody.querySelector(`.org-code-input[data-org-id="${orgId}"]`);
                if (input)
                {
                    await window.keyManagerModule.updateOrganizationCode(orgId, input.value.trim());
                }
            }
            else if (target.classList.contains('toggle-org-status-btn'))
            {
                await window.keyManagerModule.toggleOrganizationDisableStatus(orgId);
            }
            else if (target.classList.contains('delete-org-btn'))
            {
                await window.keyManagerModule.deleteOrganization(orgId);
            }
        });
    }

    // --- SCHEDULE MANAGER LISTENERS ---
    const scheduleManagerBtn = document.getElementById('schedule-manager-btn');
    const viewScheduleBtn = document.getElementById('view-schedule-btn');
    const scheduleManagerModal = document.getElementById('schedule-manager-modal');

    // Admin: Open Schedule Manager
    if (scheduleManagerBtn)
    {
        scheduleManagerBtn.addEventListener('click', () =>
        {
            if (!window.activeOrganizationId)
            {
                alert('Please search for and select a church first.');
                return;
            }
            window.scheduleModule.openScheduleManager();
        });
    }

    // Non-Admin: View Schedule
    if (viewScheduleBtn)
    {
        viewScheduleBtn.addEventListener('click', () =>
        {
            if (!window.activeOrganizationId)
            {
                alert('Please search for and select a church first.');
                return;
            }
            // Use same modal but the module handles read-only state based on role
            window.scheduleModule.openScheduleManager();
        });
    }

    // Handle Quarter Tabs
    document.querySelectorAll('.quarter-tab').forEach(tab =>
    {
        tab.addEventListener('click', (e) =>
        {
            const quarter = parseInt(e.target.dataset.quarter);
            window.scheduleModule.switchQuarter(quarter);
        });
    });

    document.querySelector('.close-schedule-manager-modal-btn')?.addEventListener('click', () =>
    {
        scheduleManagerModal.style.display = 'none';
    });

    // --- MODAL CLOSE LISTENERS ---
    document.querySelector('.close-login-modal-btn').addEventListener('click', () => loginModal.style.display = 'none');
    document.querySelector('.close-signup-modal-btn').addEventListener('click', () => signupModal.style.display = 'none');
    document.querySelector('.close-edit-modal-btn').addEventListener('click', () => editSongModal.style.display = 'none');
    document.querySelector('.close-add-modal-btn').addEventListener('click', () => addSongModal.style.display = 'none');
    document.querySelector('.close-user-management-modal-btn').addEventListener('click', () => userManagementModal.style.display = 'none');
    document.querySelector('.close-key-manager-modal-btn')?.addEventListener('click', () => keyManagerModal.style.display = 'none');
    document.querySelector('.close-forgot-password-modal-btn').addEventListener('click', () => forgotPasswordModal.style.display = 'none');

    const closeSetlistModalBtn = setlistModal?.querySelector('.close-modal-btn');
    if (closeSetlistModalBtn)
    {
        closeSetlistModalBtn.addEventListener('click', () =>
        {
            setlistModal.style.display = 'none';
            window.setlistModule.updateTableOneWithSetlist();
        });
    }

    // Close modals when clicking outside (Only for specific ones like Login/Signup if desired)
    window.addEventListener('click', (event) =>
    {
        if (event.target == loginModal) loginModal.style.display = 'none';
        if (event.target == signupModal) signupModal.style.display = 'none';
        // Removed outside-click closure for setlist, user management, and key manager
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
    // Removed outside-click closure for organization modal

    // Close disabled org modal when clicking outside
    const disabledOrgModal = document.getElementById('disabled-org-modal');
    if (disabledOrgModal)
    {
        window.addEventListener('click', (event) =>
        {
            if (event.target === disabledOrgModal)
            {
                disabledOrgModal.style.display = 'none';
            }
        });
    }

    // --- AUTH STATE CHANGE ---
    let lastSessionUserId = null;

    supabaseClient.auth.onAuthStateChange(async (event, session) =>
    {
        const currentUserId = session?.user?.id;
        console.log('Auth state changed:', event, currentUserId);

        if (event === 'PASSWORD_RECOVERY')
        {
            console.log('Password recovery mode detected.');
            resetPasswordModal.style.display = 'block';
        }

        // Handle email confirmation - prevent auto-login
        if (event === 'SIGNED_IN')
        {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('confirmed') === 'true')
            {
                console.log('Email confirmed - signing out and redirecting to login');
                // Sign out immediately to prevent auto-login
                await supabaseClient.auth.signOut();
                // Clear the URL parameter
                window.history.replaceState({}, document.title, window.location.pathname);
                // Show login modal
                loginModal.style.display = 'block';
                // Show a success message
                loginMsg.textContent = 'Email confirmed! Please log in with your credentials.';
                loginMsg.style.color = 'green';
                loginMsg.classList.add('success');
                return; // Don't proceed with normal sign-in flow
            }
        }

        // Optimization: duplicate events often fire (INITIAL_SESSION then SIGNED_IN)
        // If we are already handling this user, don't spam initialization.
        // Exception: SIGNED_OUT needs to be handled always.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
        {
            if (lastSessionUserId === currentUserId)
            {
                // Only skip if we already have an active organization and a known role.
                // On page reload (or bfcache) we may receive duplicate events but still
                // need to re-run initialization if role/org state was lost.
                const knownRole = window.authModule && window.authModule.getCurrentUserRole ? window.authModule.getCurrentUserRole() : null;
                if (window.activeOrganizationId && knownRole)
                {
                    console.log("Skipping redundant init for same user (state intact)");
                    return;
                }
                // Otherwise fall through and re-run initialization to restore UI.
            }
        }

        lastSessionUserId = currentUserId;

        // 1. Update visual Auth State (buttons, etc.)
        window.authModule.updateAuthState(session?.user);

        // 2. Initialize Organization State
        await window.organizationModule.initializeOrganizationState(session?.user || null);
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
