/**
 * Authentication Module
 * Handles user authentication (login, signup, logout)
 */

let currentUserRole = null;

async function fetchUserRole(userId, passedOrgId)
{
    const supabaseClient = window.getSupabaseClient();
    if (!userId) return 'User';
    try
    {
        const orgId = passedOrgId || window.activeOrganizationId; // Prefer passed ID
        if (!orgId)
        {
            return 'User';
        }

        const { data, error } = await supabaseClient
            .from('organization_members')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (error)
        {
            throw error;
        }

        return data ? data.role : 'User';
    } catch (error)
    {
        console.error("Error fetching user role:", error);
        return 'User';
    }
}

async function signInWithEmail(email, password)
{
    const supabaseClient = window.getSupabaseClient();
    // Just authenticate directly - Supabase Auth handles user existence check
    try
    {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        return { data, error };
    } catch (err)
    {
        return { data: null, error: err };
    }
}

async function signOut()
{
    const supabaseClient = window.getSupabaseClient();
    const { error } = await supabaseClient.auth.signOut();
    return { error };
}

async function signUpUser(name, email, password)
{
    const supabaseClient = window.getSupabaseClient();

    // 1. Sign up the user in Auth
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: name
            }
        }
    });

    console.log('signUpUser: auth signup response', { userId: data?.user?.id, hasSession: !!data?.session, authError: error });

    // 2. If signup was successful, attempt to create the profile row via server RPC.
    // The RPC runs as security-definer (postgres owner) so it can bypass RLS
    // and create the profile even if we don't have an active session yet.
    if (data.user && !error)
    {
        try
        {
            console.log('signUpUser: calling create_profile_for_current_user RPC for user', data.user.id);
            // Note: we use the user's id from the signup response, and the RPC will use auth.uid()
            // which should be set during the RPC execution context.
            const { error: rpcErr } = await supabaseClient.rpc('create_profile_for_current_user');
            if (rpcErr)
            {
                console.error('Profile RPC insert failed after signUp:', rpcErr);
            } else
            {
                console.log('Profile RPC insert succeeded');
            }
        } catch (profileError)
        {
            console.error('Profile RPC insert threw:', profileError);
        }
    }

    console.log('signUpUser: final result', { success: !error, errorMsg: error?.message });
    return { data, error };
}

async function sendResetPasswordEmail(email)
{
    const supabaseClient = window.getSupabaseClient();
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email);
    return { data, error };
}

async function updatePassword(newPassword)
{
    const supabaseClient = window.getSupabaseClient();
    const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword
    });
    return { data, error };
}

async function updateAuthState(user)
{
    const loginModalBtn = document.getElementById('login-modal-btn');
    const signupModalBtn = document.getElementById('signup-modal-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const manageSetlistBtn = document.getElementById('manage-setlist-btn');
    const addSongBtnTrigger = document.getElementById('add-song-btn');
    const userManagementBtn = document.getElementById('user-management-btn');
    const keyManagerBtn = document.getElementById('key-manager-btn');
    const searchOnlineBtn = document.getElementById('search-online-btn');

    document.body.classList.toggle('logged-in', !!user);

    if (user)
    {
        loginModalBtn.style.display = 'none';
        signupModalBtn.style.display = 'none';

        // Reset logout button if it was stuck
        logoutBtn.style.display = 'inline-block';
        logoutBtn.textContent = 'Logout';
        logoutBtn.disabled = false;

        // Show the switch church button when logged in
        const switchChurchBtn = document.getElementById('switch-church-btn');
        if (switchChurchBtn) switchChurchBtn.style.display = 'inline-block';

        // Role fetching is now deferred to organization selection
        // We just ensure the basic state is "logged in" here
    } else
    {
        loginModalBtn.style.display = 'inline-block';
        signupModalBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';

        // Hide the switch church button when logged out
        const switchChurchBtn = document.getElementById('switch-church-btn');
        if (switchChurchBtn) switchChurchBtn.style.display = 'none';

        currentUserRole = null;
        manageSetlistBtn.style.display = 'none';
        addSongBtnTrigger.style.display = 'none';
        userManagementBtn.style.display = 'none';
        if (searchOnlineBtn) searchOnlineBtn.style.display = 'none';
        if (keyManagerBtn) keyManagerBtn.style.display = 'none';
    }
}

// Export functions
window.authModule = {
    fetchUserRole,
    signInWithEmail,
    signOut,
    signUpUser,
    updateAuthState,
    refreshUserRole,
    sendResetPasswordEmail,
    updatePassword,
    getCurrentUserRole: () => currentUserRole
};

/**
 * Refreshes the user role based on the current active organization.
 * Should be called whenever the organization changes.
 */
async function refreshUserRole(userId, orgId, knownRole = null)
{
    if (!userId || !orgId)
    {
        currentUserRole = 'User'; // Default safety
    } else if (knownRole)
    {
        // Optimization: Use the role we already know (e.g. from cached memberships)
        console.log("Using known role:", knownRole);
        currentUserRole = knownRole;
    } else
    {
        currentUserRole = await fetchUserRole(userId, orgId); // Pass orgId explicitly
    }

    // Trigger UI updates that depend on the role
    updateUIForRole(!!userId);
}

/**
 * Internal helper to update UI elements based on current role
 */
function updateUIForRole(isLoggedIn)
{
    const manageSetlistBtn = document.getElementById('manage-setlist-btn');
    const addSongBtnTrigger = document.getElementById('add-song-btn');
    const searchOnlineBtn = document.getElementById('search-online-btn');
    const userManagementBtn = document.getElementById('user-management-btn');
    const keyManagerBtn = document.getElementById('key-manager-btn');

    if (!isLoggedIn)
    {
        // Logged out state handled in updateAuthState, but safety here:
        if (manageSetlistBtn) manageSetlistBtn.style.display = 'none';
        if (addSongBtnTrigger) addSongBtnTrigger.style.display = 'none';
        if (userManagementBtn) userManagementBtn.style.display = 'none';
        return;
    }

    // Role-Based Access Control (RBAC)
    // Admin: Full Access
    // User: Read Only (Can see Switch Church, Logout, but NO editing/adding)

    // Master Admin (Fixed email)
    const supabaseClient = window.getSupabaseClient();

    // Use getSession() which is synchronous if the session is already loaded in memory
    // This makes the UI update much faster than getUser()
    supabaseClient.auth.getSession().then(({ data: { session } }) =>
    {
        const user = session?.user;
        const isMasterAdmin = user?.email === 'eugenekoenn@gmail.com';

        // Case-insensitive check to be safe
        const role = currentUserRole ? currentUserRole.toLowerCase() : '';
        const isAdmin = (role === 'admin');

        // Super Admin (eugenekoenn@gmail.com) gets admin permissions if ANY organization is selected
        const canEdit = isAdmin || (isMasterAdmin && window.activeOrganizationId);

        console.log(`UpdateUIForRole: Role='${currentUserRole}', IsAdmin=${isAdmin}, IsMasterAdmin=${isMasterAdmin}, ActiveOrg=${window.activeOrganizationId}`);

        if (manageSetlistBtn) manageSetlistBtn.style.display = canEdit ? 'inline-block' : 'none';
        if (addSongBtnTrigger) addSongBtnTrigger.style.display = canEdit ? 'inline-block' : 'none';
        if (searchOnlineBtn) searchOnlineBtn.style.display = canEdit ? 'inline-block' : 'none';
        if (userManagementBtn) userManagementBtn.style.display = (isAdmin || isMasterAdmin) && window.activeOrganizationId ? 'inline-block' : 'none';
        if (keyManagerBtn) keyManagerBtn.style.display = isMasterAdmin ? 'inline-block' : 'none';
    });
}
