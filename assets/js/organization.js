/**
 * Organization Module
 * Handles joining, switching, and managing church memberships.
 */

// This will hold the ID of the currently selected church
window.activeOrganizationId = null;
// This will hold the list of memberships for the current user
let userMemberships = [];

// Flag to prevent concurrent initializations
let isInitializing = false;
let lastInitializedUser = null;

/**
 * Fetches the user's memberships and determines the initial state.
 * This should be called after a user logs in or on page load if logged in.
 */
async function initializeOrganizationState(passedUser)
{
    // 1. Debounce / Singleton Check
    if (isInitializing)
    {
        console.log('Organization initialization already in progress, skipping...');
        return;
    }

    const supabaseClient = window.getSupabaseClient();
    let user = passedUser;

    // Use passedUser directly if provided (even if null). 
    // Only fetch if passedUser is strictly undefined (auto-init call).
    if (user === undefined)
    {
        const { data } = await supabaseClient.auth.getUser();
        user = data.user;
    }

    const churchNameDisplay = document.getElementById('textdiv');

    if (!user)
    {
        // No user, clear everything
        window.activeOrganizationId = null;
        localStorage.removeItem('activeOrganizationId'); // Clear persisted state
        userMemberships = [];
        if (churchNameDisplay) churchNameDisplay.textContent = 'The Praise and Worship App';
        // Reset nav brand to default
        if (window.updateNavBrand)
        {
            window.updateNavBrand(null);
        }
        window.songsModule.populateSongDatabaseTable(null);
        if (window.setlistModule && window.setlistModule.loadSetlistFromSupabase)
        {
            window.setlistModule.loadSetlistFromSupabase(null);
        }
        lastInitializedUser = null;
        return;
    }

    // prevent re-initialization for the same user if we already did it successfully
    // BUT we must allow it if we are doing a "hard refresh" or if the user explicitly requested it.
    // For now, we'll rely on isInitializing to stop race conditions.

    isInitializing = true;
    console.log('initializeOrganizationState called for user:', user.id);

    try
    {
        // 1. INSTANT CACHE LOAD (Memberships)
        // Load memberships from cache so we have them even if offline
        const cachedMemberships = localStorage.getItem(`cachedUserMemberships_${user.id}`);
        if (cachedMemberships)
        {
            try
            {
                userMemberships = JSON.parse(cachedMemberships);
                console.log("Loaded cached memberships:", userMemberships.length);
            } catch (e)
            {
                console.warn("Error parsing cached memberships", e);
            }
        }

        // 2. OPTIMISTIC LOADING
        // Immediately try to load based on localStorage to give instant feedback
        const savedOrgId = localStorage.getItem('activeOrganizationId');
        if (savedOrgId)
        {
            console.log('Optimistic load: found saved org ID', savedOrgId);
            window.activeOrganizationId = savedOrgId; // Set temporarilly

            // --- NEW: Optimistic Role Update ---
            // If we have cached memberships, we know the role!
            // DO THIS BEFORE loading songs so the render knows we are admin
            const cachedMem = userMemberships.find(m => m.organization_id === savedOrgId);
            if (cachedMem && window.authModule && window.authModule.refreshUserRole)
            {
                // We await this briefly or just fire it. refreshUserRole is async but sets the global var synchronously if possible?
                // Actually refreshUserRole is async. We should await it if we want to be sure.
                // But since we are inside an async function, let's await it to be safe.
                await window.authModule.refreshUserRole(user.id, savedOrgId, cachedMem.role);
            }

            // Trigger data load in background (optimistic)
            // Now that role is set, this render will be correct
            window.songsModule.populateSongDatabaseTable(savedOrgId);
            if (window.setlistModule) window.setlistModule.loadSetlistFromSupabase(savedOrgId);

            // Update Title (Provisionally)
            const savedName = localStorage.getItem('activeOrganizationName');
            if (churchNameDisplay)
            {
                churchNameDisplay.textContent = savedName ? `Church: ${savedName}` : 'Loading Church...';
            }
            // Update nav brand with the saved church name
            if (savedName && window.updateNavBrand)
            {
                window.updateNavBrand(savedName);
            }
        }

        // 3. Official Membership Fetch (Soft Timeout)
        // We race the fetch against a 5s timer. If timeout wins, we assume "Offline" 
        // and stick with optimistic data (if any).
        const fetchPromise = supabaseClient
            .from('organization_members')
            .select('id, user_id, organization_id, role, joined_at')
            .eq('user_id', user.id);

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 1500));

        const raceResult = await Promise.race([fetchPromise, timeoutPromise]);

        if (raceResult === 'TIMEOUT')
        {
            console.log("Network slow. Using cached membership data.");

            // If we have no cache, we are in a tough spot. We don't know if the user is a member.
            // But for UX, we should probably default to 'User' access if we have a saved Org ID, 
            // so they're not locked out of their own potential church.
            if (userMemberships.length === 0 && savedOrgId && window.authModule)
            {
                console.warn("No cache found on timeout. Defaulting to 'User' role.");
                // Force 'User' role so buttons appear
                window.authModule.refreshUserRole(user.id, savedOrgId, 'User');
            }

            return;
        }

        const { data: membershipsData, error: memError } = raceResult;

        console.log('Memberships fetch result:', { count: membershipsData?.length, error: memError });

        if (memError) throw memError;

        let memberships = membershipsData || [];

        if (memberships.length === 0)
        {
            console.warn("No memberships found for user", user.id);
            userMemberships = [];
            localStorage.removeItem(`cachedUserMemberships_${user.id}`); // Clear cache

            window.activeOrganizationId = null;
            localStorage.removeItem('activeOrganizationId');
            if (churchNameDisplay) churchNameDisplay.textContent = 'Join a Church';
            // Reset nav brand to default
            if (window.updateNavBrand)
            {
                window.updateNavBrand(null);
            }
            // openOrganizationModal(); // DO NOT POP UP IMMEDIATELY
            // Clear the optimistic data if it was wrong
            window.songsModule.populateSongDatabaseTable(null);
            if (window.setlistModule) window.setlistModule.loadSetlistFromSupabase(null);
            return;
        }

        // 4. Fetch Organization Details
        const orgIds = memberships.map(m => m.organization_id);
        const { data: orgs, error: orgError } = await supabaseClient
            .from('organizations')
            .select('id, name, is_disabled')
            .in('id', orgIds);

        if (orgError) throw orgError;

        // Combine
        userMemberships = memberships.map(m => ({
            ...m,
            organization: orgs.find(o => o.id === m.organization_id) || { name: 'Unknown', is_disabled: false }
        }));

        // UPDATE CACHE
        localStorage.setItem(`cachedUserMemberships_${user.id}`, JSON.stringify(userMemberships));

        // 5. Reconcile Optimistic State
        // Check if the saved ID is actually valid in the fetched memberships
        const verifiedMembership = savedOrgId ? userMemberships.find(m => m.organization_id === savedOrgId) : null;

        if (verifiedMembership)
        {
            // Success! The optimistic load was correct.
            if (churchNameDisplay) churchNameDisplay.textContent = `Church: ${verifiedMembership.organization.name}`;
            // Update nav brand with the church name
            if (window.updateNavBrand)
            {
                window.updateNavBrand(verifiedMembership.organization.name);
            }
            if (window.authModule && window.authModule.refreshUserRole)
            {
                // Pass the verified role
                window.authModule.refreshUserRole(verifiedMembership.user_id, savedOrgId, verifiedMembership.role);
            }
        } else
        {
            // The saved ID was NOT valid (user maybe left that church?)
            // Or this is a fresh login with no saved ID.
            if (userMemberships.length === 1)
            {
                setActiveOrganization(userMemberships[0].organization_id);
            } else
            {
                // But wait, if we are here, it means we fetched memberships successfully.
                // If the SavedOrgID isn't in them, we must clear it.
                // UNLESS we want to be super persistent? No, if we have fresh data saying "you aren't a member", we should respect it.
                window.activeOrganizationId = null;
                if (churchNameDisplay) churchNameDisplay.textContent = 'Select a Church';
                // Reset nav brand to default
                if (window.updateNavBrand)
                {
                    window.updateNavBrand(null);
                }
                // openOrganizationModal(); // DO NOT POP UP IMMEDIATELY
                if (savedOrgId)
                {
                    window.songsModule.populateSongDatabaseTable(null);
                    window.setlistModule.loadSetlistFromSupabase(null);
                }
            }
        }

        lastInitializedUser = user.id;

    } catch (err)
    {
        console.error("Critical error in initializeOrganizationState:", err);
        // Do not alert aggressively for timeouts unless persistent
    } finally
    {
        isInitializing = false;
    }
}

/**
 * Completely clears the organization state (e.g., on logout).
 */
function clearOrganizationState()
{
    window.activeOrganizationId = null;
    userMemberships = [];
    lastInitializedUser = null;
    isInitializing = false; // Reset lock just in case

    const churchNameDisplay = document.getElementById('textdiv');
    if (churchNameDisplay) churchNameDisplay.textContent = 'The Praise and Worship App';

    localStorage.removeItem('activeOrganizationId');
    localStorage.removeItem('activeOrganizationName');

    if (window.songsModule) window.songsModule.populateSongDatabaseTable(null);
    if (window.setlistModule) window.setlistModule.loadSetlistFromSupabase(null);
}

/**
 * Sets the active organization and refreshes the app's data.
 * @param {string} organizationId - The UUID of the organization to activate.
 */
function setActiveOrganization(organizationId)
{
    const membership = userMemberships.find(m => m.organization_id === organizationId);
    if (!membership)
    {
        console.error(`Attempted to switch to an invalid organization: ${organizationId}`);
        return;
    }

    // Check if organization is disabled
    if (membership.organization && membership.organization.is_disabled)
    {
        showDisabledOrganizationModal(membership.organization.name);
        return;
    }

    if (window.activeOrganizationId === organizationId) return; // No change

    window.activeOrganizationId = organizationId;
    localStorage.setItem('activeOrganizationId', organizationId); // Persist ID
    localStorage.setItem('activeOrganizationName', membership.organization.name); // Persist Name

    const churchNameDisplay = document.getElementById('textdiv');
    if (churchNameDisplay)
    {
        churchNameDisplay.textContent = `Church: ${membership.organization.name}`;
    }

    // Update nav brand with the church name and hide subtitle
    if (window.updateNavBrand)
    {
        window.updateNavBrand(membership.organization.name);
    }

    // Update navigation bar with organization and role info
    if (window.updateNavInfo)
    {
        window.updateNavInfo(membership.organization.name, membership.role);
    }

    // Refresh User Role for this new Org (Pass Known Role!)
    if (window.authModule && window.authModule.refreshUserRole)
    {
        console.log(`Setting active org ${organizationId}. user=${membership.user_id}, role=${membership.role}`);
        window.authModule.refreshUserRole(membership.user_id, organizationId, membership.role);
    }

    // --- CRITICAL: Reload data for the new organization ---
    window.songsModule.populateSongDatabaseTable(organizationId);
    if (window.setlistModule && window.setlistModule.loadSetlistFromSupabase)
    {
        window.setlistModule.loadSetlistFromSupabase(organizationId);
    }

    // Close the modal
    const orgModal = document.getElementById('organization-modal');
    if (orgModal) orgModal.style.display = 'none';
}

/**
 * Show error modal when organization is disabled/unpaid
 */
function showDisabledOrganizationModal(organizationName)
{
    const modal = document.getElementById('disabled-org-modal');
    const nameSpan = modal ? modal.querySelector('.disabled-org-name') : null;
    if (modal && nameSpan)
    {
        nameSpan.textContent = organizationName;
        modal.style.display = 'block';
    }
}

/**
 * Opens the modal and populates it with the user's current organizations.
 */
function openOrganizationModal()
{
    const orgModal = document.getElementById('organization-modal');
    const orgList = document.getElementById('organization-list');
    if (!orgModal || !orgList) return;

    orgList.innerHTML = ''; // Clear previous list

    if (userMemberships.length === 0)
    {
        orgList.innerHTML = '<li>You have not joined any churches yet. Use the form below.</li>';
    } else
    {
        userMemberships.forEach(membership =>
        {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '8px 0';
            li.innerHTML = `
                <span style="flex: 1; margin-right: 15px;">${membership.organization.name} (Role: ${membership.role})</span>
                <div style="display: flex; gap: 8px;">
                    <button class="modal-btn leave-org-btn" data-org-id="${membership.organization_id}" data-org-name="${membership.organization.name.replace(/"/g, '&quot;')}" style="background-color: #666; padding: 6px 12px; font-size: 12px;">Leave</button>
                    <button class="modal-btn switch-org-btn" data-org-id="${membership.organization_id}" style="padding: 6px 12px; font-size: 12px;">Select</button>
                </div>
            `;

            orgList.appendChild(li);
        });
    }

    orgModal.style.display = 'block';
}

/**
 * Normalizes an organization code by removing spaces, special characters,
 * and converting to uppercase for consistent matching.
 */
function normalizeOrgCode(code)
{
    // Remove all spaces, hyphens, underscores, and special characters
    // Keep only alphanumeric characters
    // Convert to uppercase for case-insensitive matching
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Handles the logic for joining a new church using a signup code.
 */
async function joinOrganization()
{
    const supabaseClient = window.getSupabaseClient();
    const codeInput = document.getElementById('join-code-input');
    const joinMsg = document.getElementById('join-org-msg');
    const codePreview = document.getElementById('join-code-preview');
    const rawCode = codeInput.value;
    const normalizedCode = normalizeOrgCode(rawCode);

    if (!normalizedCode)
    {
        joinMsg.textContent = "Please enter a code.";
        codePreview.textContent = '';
        return;
    }

    // Show what we're sending (for user transparency)
    if (rawCode !== normalizedCode)
    {
        codePreview.textContent = `Code being checked: ${normalizedCode}`;
    }

    joinMsg.textContent = "Verifying code...";
    joinMsg.style.color = '#333';

    const { data: orgData, error: rpcError } = await supabaseClient.rpc('get_org_by_code', { code_input: normalizedCode });

    // RPC returns an array of rows, so get the first one
    const org = orgData && orgData.length > 0 ? orgData[0] : null;

    if (rpcError || !org || !org.id)
    {
        joinMsg.textContent = "Invalid or expired code.";
        joinMsg.style.color = 'red';
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    // Check if any members already exist for this organization
    // Note: This relies on the SELECT policy allowing this check.
    const { count, error: countError } = await supabaseClient
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id);

    if (countError)
    {
        console.warn("Could not check member count, defaulting to User:", countError);
    }

    const initialRole = (count === 0) ? 'Admin' : 'User';

    const { error: insertError } = await supabaseClient
        .from('organization_members')
        .insert({ organization_id: org.id, user_id: user.id, role: initialRole });

    if (insertError)
    {
        joinMsg.textContent = insertError.code === '23505' ? "You are already a member of this church." : `Error: ${insertError.message}`;
        joinMsg.style.color = 'red';
        return;
    }

    joinMsg.textContent = `Successfully joined ${org.name}!`;
    joinMsg.style.color = 'green';
    codeInput.value = '';

    // Refresh everything
    await initializeOrganizationState();
    // Re-render the list inside the modal with the new church
    openOrganizationModal();
}

/**
 * Shows the confirmation modal for leaving a church
 */
function showLeaveConfirmation(orgId, orgName)
{
    const confirmModal = document.getElementById('confirmation-modal');
    const confirmMsg = document.getElementById('confirmation-message');
    const confirmYes = document.getElementById('confirm-yes-btn');
    const confirmNo = document.getElementById('confirm-no-btn');

    if (!confirmModal || !confirmMsg || !confirmYes || !confirmNo) return;

    confirmMsg.textContent = `Hey, are you sure that you want to leave the church "${orgName}"?`;

    // Cleanup previous listeners
    const newConfirmYes = confirmYes.cloneNode(true);
    const newConfirmNo = confirmNo.cloneNode(true);
    confirmYes.parentNode.replaceChild(newConfirmYes, confirmYes);
    confirmNo.parentNode.replaceChild(newConfirmNo, confirmNo);

    newConfirmNo.onclick = () =>
    {
        confirmModal.style.display = 'none';
    };

    newConfirmYes.onclick = async () =>
    {
        confirmModal.style.display = 'none';
        await leaveOrganization(orgId);
    };

    confirmModal.style.display = 'block';
}

/**
 * Logical removal of membership
 */
async function leaveOrganization(orgId)
{
    const supabaseClient = window.getSupabaseClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) return;

    try
    {
        const { error } = await supabaseClient
            .from('organization_members')
            .delete()
            .eq('organization_id', orgId)
            .eq('user_id', user.id);

        if (error) throw error;

        // If the org we left was the active one, clear it
        if (window.activeOrganizationId === orgId)
        {
            window.activeOrganizationId = null;
            localStorage.removeItem('activeOrganizationId');
            localStorage.removeItem('activeOrganizationName');
        }

        // Refresh state
        await initializeOrganizationState();

        // Re-open/refresh modal
        openOrganizationModal();

    } catch (err)
    {
        console.error("Error leaving organization:", err);
        alert("Failed to leave the church: " + err.message);
    }
}

// Export functions to be used in init.js
window.organizationModule = {
    initializeOrganizationState,
    setActiveOrganization,
    showDisabledOrganizationModal,
    openOrganizationModal,
    joinOrganization,
    clearOrganizationState,
    normalizeOrgCode,
    showLeaveConfirmation,
    leaveOrganization
};