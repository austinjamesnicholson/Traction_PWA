import { config } from "./config.js";
import { createJournalSync } from "./sync.js";
export function createCloud({
  storage,
  exercises,
  templates,
  onData = () => {},
  onStatus = () => {},
}) {
  let client = null,
    recovery = false,
    ready = false,
    authError = "",
    pollTimer = null,
    subscription = null;
  const ensure = () => {
    if (!client)
      throw new Error(
        "Account connection is unavailable. Reopen the app online to finish setup.",
      );
  };
  const result = async (request) => {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  };
  const remote = {
    async read(id) {
      ensure();
      return result(
        client
          .from("traction_documents")
          .select("data,revision")
          .eq("user_id", id)
          .maybeSingle()
          .abortSignal(AbortSignal.timeout(20000)),
      );
    },
    async save(id, revision, data) {
      ensure();
      return result(
        client
          .rpc("save_traction_document", {
            expected_revision: revision,
            document: data,
            owner_id: id,
          })
          .abortSignal(AbortSignal.timeout(20000)),
      );
    },
  };
  const engine = createJournalSync({
    storage,
    exercises,
    templates,
    remote,
    onData,
    onStatus,
    online: () => navigator.onLine !== false,
  });
  const redirectTo = () => new URL("./", location.href).href;
  const attach = (session) => {
    if (session?.user?.is_anonymous)
      throw new Error("Sign in with an email account to use cloud storage.");
    const changed = engine.account?.id !== (session?.user?.id || undefined);
    engine.attach(session?.user || null);
    if (changed && ready) {
      window.dispatchEvent(new Event("traction-account-change"));
    }
  };
  function drawStatus() {
    onStatus(
      authError ? { state: "error", message: authError } : engine.status,
    );
  }
  return {
    store: engine.store,
    get account() {
      return engine.account;
    },
    get status() {
      return authError ? { state: "error", message: authError } : engine.status;
    },
    get recovery() {
      return recovery;
    },
    get pending() {
      return engine.pending;
    },
    async start() {
      if (!globalThis.supabase?.createClient) {
        authError = "Account library did not load. Reload online to sign in.";
        drawStatus();
        return;
      }
      client = globalThis.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublicKey,
        {
          auth: {
            storageKey: "traction-account-auth-v1",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "implicit",
          },
        },
      );
      const listener = client.auth.onAuthStateChange((event, session) => {
        // Supabase holds an auth lock during callbacks; perform async work after it releases.
        setTimeout(() => {
          try {
            if (event === "PASSWORD_RECOVERY") {
              recovery = true;
              location.hash = "#profile";
            }
            if (event === "SIGNED_OUT") recovery = false;
            attach(session);
            authError = "";
            drawStatus();
            if (engine.account) engine.schedule();
          } catch (error) {
            authError = error.message;
            onData();
            drawStatus();
          }
        }, 0);
      });
      subscription = listener.data?.subscription;
      try {
        const data = await result(client.auth.getSession());
        attach(data.session);
      } catch (error) {
        authError = error.message;
      }
      ready = true;
      drawStatus();
      window.addEventListener("online", () => engine.sync());
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) engine.sync();
      });
      pollTimer = setInterval(() => {
        if (!document.hidden) engine.sync();
      }, 15000);
      window.addEventListener("storage", (event) => {
        if (event.key?.startsWith("traction-pwa-v1:account:")) drawStatus();
      });
    },
    async signIn(email, password) {
      ensure();
      const data = await result(
        client.auth.signInWithPassword({ email, password }),
      );
      attach(data.session);
      authError = "";
      await engine.sync();
    },
    async signUp(email, password) {
      ensure();
      const data = await result(
        client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo() },
        }),
      );
      if (data.session) {
        attach(data.session);
        await engine.sync();
      }
      return Boolean(data.session);
    },
    async resetPassword(email) {
      ensure();
      await result(
        client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }),
      );
    },
    async updatePassword(password) {
      ensure();
      if (!recovery)
        throw new Error("Open the password reset link from your email first.");
      await result(client.auth.updateUser({ password }));
      recovery = false;
      onData();
    },
    async requestRecommendation(payload) {
      ensure();
      const owner = engine.account?.id;
      if (!owner) throw new Error("Sign in to request AI guidance.");
      const { data, error } = await client.functions.invoke(
        "workout-recommendation",
        { body: payload, timeout: 50000 },
      );
      if (engine.account?.id !== owner)
        throw new Error("Your account changed during this request.");
      if (error) {
        let message =
          "AI guidance could not be loaded. Check your connection and try again.";
        try {
          const body = await error.context?.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          /* do not expose internal error details */
        }
        throw new Error(message);
      }
      return data;
    },
    async signOut() {
      ensure();
      // Switch journals immediately, so a response already in flight cannot reappear after logout.
      engine.attach(null);
      recovery = false;
      onData();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) {
        const { data } = await client.auth.getSession();
        attach(data?.session);
        onData();
        throw new Error(
          "Sign-out did not complete. Reconnect and try again; this browser may still restore your session.",
        );
      }
      authError = "";
      drawStatus();
    },
    sync: (prefer) => engine.sync(prefer),
    dispose: () => {
      clearInterval(pollTimer);
      subscription?.unsubscribe();
      engine.dispose();
    },
  };
}
