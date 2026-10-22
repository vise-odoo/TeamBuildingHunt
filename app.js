(() => {
  // --- Supabase configuration ---
  const SUPABASE_URL = "https://dhcohqbbnlfkjpihoqop.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_6yOHVUYtYfCciLGBRRuQLg_-L8W74ft";

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const TEAM_KEY = "team-hunt:team_id";
  const CHAT_READ_KEY = "team-hunt:chat_last_read";
  const TOTAL_STEPS = 7;

  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const navHunt = document.getElementById("nav-hunt");
  const navProgress = document.getElementById("nav-progress");
  const navChat = document.getElementById("nav-chat");
  const chatBadge = document.getElementById("chat-badge");
  const teamBar = document.getElementById("team-bar");
  const teamBarName = document.getElementById("team-bar-name");
  const teamBarChange = document.getElementById("team-bar-change");

  let currentView = "hunt";
  let progressChannel = null;
  let chatChannel = null;
  let myProgressChannel = null;
  let shownStep = null;

  navHunt.addEventListener("click", () => switchView("hunt"));
  navProgress.addEventListener("click", () => switchView("progress"));
  navChat.addEventListener("click", () => switchView("chat"));
  teamBarChange.addEventListener("click", () => {
    localStorage.removeItem(TEAM_KEY);
    currentView = "hunt";
    navHunt.setAttribute("aria-current", "true");
    navProgress.setAttribute("aria-current", "false");
    navChat.setAttribute("aria-current", "false");
    teamBar.hidden = true;
    renderTeamPicker();
  });

  function switchView(view) {
    currentView = view;
    navHunt.setAttribute("aria-current", String(view === "hunt"));
    navProgress.setAttribute("aria-current", String(view === "progress"));
    navChat.setAttribute("aria-current", String(view === "chat"));
    if (view === "hunt") renderHunt();
    else if (view === "progress") renderProgressView();
    else renderChatView();
  }

  function getMyTeamId() {
    return localStorage.getItem(TEAM_KEY);
  }

  let teamsCache = null;
  async function getTeams() {
    if (!teamsCache) {
      const { data } = await client.from("teams").select("id, name").order("id");
      teamsCache = data || [];
    }
    return teamsCache;
  }

  async function showTeamBar() {
    const teams = await getTeams();
    const myTeamId = getMyTeamId();
    if (!myTeamId) return;
    const team = teams.find(t => t.id === myTeamId);
    teamBarName.textContent = team ? team.name : myTeamId;
    teamBar.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // HTML hack to turn [word](link) into clickable links, and to display "\n" elements properly.
  function formatText(str) {
    if (!str) return "";
    const link = (url, label) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
    return escapeHtml(str)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g,
        (m, label, url, bare) => bare ? link(bare, "link") : link(url, label))
      .replace(/\\n|\r?\n/g, "<br>");
  }

  // Gives a ranking of the Teams depending on the Solo Steps
  function soloResults(progressRows, routes) {
    const results = (progressRows || []).map(r => {
      const solvedAt = {};
      (r.history || []).forEach(h => { solvedAt[h.order_index] = new Date(h.solved_at); });
      const soloSteps = (routes || [])
        .filter(rt => rt.team_id === r.team_id && !rt.fragment && rt.order_index > 1)
        .map(rt => rt.order_index);
      let ms = 0;
      let complete = soloSteps.length > 0;
      soloSteps.forEach(k => {
        if (solvedAt[k] && solvedAt[k - 1]) ms += solvedAt[k] - solvedAt[k - 1];
        else complete = false;
      });
      const last = (r.history || []).find(h => h.order_index === TOTAL_STEPS);
      const finishedAt = r.current_index > TOTAL_STEPS ? new Date(last ? last.solved_at : r.updated_at) : null;
      return { teamId: r.team_id, ms, complete, finishedAt };
    });
    results
      .filter(r => r.complete)
      .sort((a, b) => a.ms - b.ms)
      .forEach((r, i) => { r.place = i + 1; });
    return Object.fromEntries(results.map(r => [r.teamId, r]));
  }

  function formatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    const h = Math.floor(minutes / 60);
    return h ? `${h}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
  }

  function ordinal(n) {
    return n + ({ 1: "st", 2: "nd", 3: "rd" }[n] || "th");
  }

  function formatClock(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getLastRead() {
    return localStorage.getItem(CHAT_READ_KEY) || new Date(0).toISOString();
  }

  let unreadCount = 0;

  function setChatBadge(count) {
    unreadCount = Math.max(0, count);
    chatBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    chatBadge.hidden = unreadCount === 0;
    chatBadge.classList.toggle("blink", unreadCount > 0);
  }

  function markChatRead(timestamp) {
    localStorage.setItem(CHAT_READ_KEY, timestamp);
    setChatBadge(0);
  }

  async function refreshChatBadge() {
    const myTeamId = getMyTeamId();
    const { count } = await client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gt("created_at", getLastRead())
      .neq("team_id", myTeamId);
    setChatBadge(count || 0);
  }

  async function fetchMyStep() {
    const { data, error } = await client
      .from("team_progress")
      .select("current_index")
      .eq("team_id", getMyTeamId())
      .single();
    return error ? null : data.current_index;
  }

  // Re-render the hunt view if the team moved on from another phone.
  async function syncHuntStep() {
    if (currentView !== "hunt" || !getMyTeamId()) return;
    const step = await fetchMyStep();
    if (step !== null && step !== shownStep) renderHunt();
  }

  function subscribeMyProgress() {
    if (myProgressChannel) return;
    myProgressChannel = client
      .channel("my-progress-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "team_progress" }, (payload) => {
        const row = payload.new;
        if (currentView === "hunt" && row.team_id === getMyTeamId() && row.current_index !== shownStep) {
          renderHunt();
        }
      })
      .subscribe();
  }

  // Phones drop the live connection while locked: catch up when back.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncHuntStep();
  });

  function subscribeChat() {
    if (chatChannel) return;
    chatChannel = client
      .channel("chat-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new;
        if (currentView === "chat") {
          appendChatMessage(msg);
          markChatRead(msg.created_at);
        } else if (msg.team_id !== getMyTeamId()) {
          setChatBadge(unreadCount + 1);
        }
      })
      .subscribe();
  }

  async function init() {
    const teamId = getMyTeamId();
    if (!teamId) {
      await renderTeamPicker();
    } else {
      nav.hidden = false;
      showTeamBar();
      subscribeChat();
      subscribeMyProgress();
      refreshChatBadge();
      renderHunt();
    }
  }

  async function renderTeamPicker() {
    nav.hidden = true;
    app.innerHTML = `<div class="center-note">Loading teams…</div>`;
    const { data: teams, error } = await client.from("teams").select("id, name").order("id");
    if (error) {
      app.innerHTML = `<div class="card"><p class="feedback error">Couldn't load the teams. Check your connection and reload the page.</p></div>`;
      return;
    }
    teamsCache = teams;
    app.innerHTML = `
      <div class="card">
        <p class="eyebrow">Before you start</p>
        <h2>Choose your team</h2>
        <p class="muted">This choice is remembered on this device, no need to pick it again.</p>
        <div class="team-list">
          ${teams.map(t => `<button data-id="${t.id}">${t.name}</button>`).join("")}
        </div>
      </div>
    `;
    app.querySelectorAll(".team-list button").forEach(btn => {
      btn.addEventListener("click", () => {
        localStorage.setItem(TEAM_KEY, btn.dataset.id);
        nav.hidden = false;
        showTeamBar();
        subscribeChat();
        subscribeMyProgress();
        refreshChatBadge();
        renderHunt();
      });
    });
  }

  async function renderHunt() {
    const teamId = getMyTeamId();
    app.innerHTML = `<div class="center-note">Loading your route…</div>`;

    const { data: progress, error: progressError } = await client
      .from("team_progress")
      .select("current_index")
      .eq("team_id", teamId)
      .single();

    if (progressError) {
      app.innerHTML = `<div class="card"><p class="feedback error">Unstable connection, try again in a moment.</p></div>`;
      return;
    }

    const step = progress.current_index;
    shownStep = step;

    if (step > TOTAL_STEPS) {
      const [{ data: rows }, { data: routes }] = await Promise.all([
        client.from("team_progress").select("team_id, current_index, history, updated_at"),
        client.from("team_routes").select("team_id, order_index, fragment"),
      ]);
      const mine = soloResults(rows, routes)[teamId];
      app.innerHTML = `
        <div class="card">
          <p class="eyebrow">Route complete</p>
          <h2>You made it!</h2>
          ${mine && mine.place ? `<p><strong>Solo puzzles: ${formatDuration(mine.ms)} - ${ordinal(mine.place)} fastest so far.</strong></p>` : ""}
          <p>All steps solved - well done, team! Your prize is... a company dinner!</p>
        </div>
      `;
      return;
    }

    const { data: route, error: routeError } = await client
      .from("team_routes")
      .select("fragment, fragment_for, location:locations(title, riddle_text, location_hint, image_url)")
      .eq("team_id", teamId)
      .eq("order_index", step)
      .maybeSingle();

    if (routeError || !route) {
      app.innerHTML = `<div class="card"><p class="feedback error">Step not found right now, try again or let the organizer know.</p></div>`;
      return;
    }

    const puzzle = route.location;

    let dispatchHtml = "";
    if (route.fragment) {
      const { data: teams } = await client.from("teams").select("id, name").order("id");
      const recipient = teams && teams.find(t => t.id === route.fragment_for) || {name: "everybody"};
      if (recipient) {
        dispatchHtml = `
          <div class="dispatch">
            <p class="eyebrow">Team dispatch</p>
            <p>Your piece: <strong>${formatText(route.fragment)}</strong></p>
            <p class="muted">Pass it on to ${recipient.name} - they'll need it to pick their code at their next shared stop.</p>
          </div>
        `;
      }
    }

    app.innerHTML = `
      <div class="card">
        <p class="eyebrow">Step ${step} / ${TOTAL_STEPS}</p>
        <h2>${puzzle.title}</h2>
        <p>${formatText(puzzle.riddle_text)}</p>
        ${puzzle.image_url ? `<img crossorigin="anonymous" src="${puzzle.image_url}" alt="" class="puzzle-image" />` : ""}
        ${puzzle.location_hint ? `<p class="muted">${formatText(puzzle.location_hint)}</p>` : ""}
        ${dispatchHtml}
        <form id="code-form">
          <input type="text" id="code-input" placeholder="Code found on site" autocomplete="off" autocapitalize="characters" required />
          <button type="submit" class="primary">Submit</button>
          <div id="code-feedback"></div>
        </form>
      </div>
    `;

    const form = document.getElementById("code-form");
    const input = document.getElementById("code-input");
    const feedback = document.getElementById("code-feedback");
    const submitBtn = form.querySelector("button");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const entered = input.value.trim().toUpperCase();
      if (!entered) return;

      submitBtn.disabled = true;
      const { data: solved, error: rpcError } = await client.rpc("check_step_code", {
        p_team_id: teamId,
        p_order_index: step,
        p_code: entered,
      });

      if (rpcError) {
        feedback.innerHTML = `<p class="feedback error">Unstable connection, try again.</p>`;
        submitBtn.disabled = false;
        return;
      }

      if (!solved) {
        const currentStep = await fetchMyStep();
        if (currentStep !== null && currentStep !== step) {
          feedback.innerHTML = `<p class="feedback success">Your team already solved this step on another phone, moving on!</p>`;
          shownStep = currentStep;
          setTimeout(renderHunt, 1500);
          return;
        }
        feedback.innerHTML = `<p class="feedback error">Incorrect code, try again.</p>`;
        submitBtn.disabled = false;
        return;
      }

      feedback.innerHTML = `<p class="feedback success">Nice, on to the next step!</p>`;
      // Keep the live update from cutting this message short.
      shownStep = step + 1;
      setTimeout(renderHunt, 900);
    });
  }

  async function renderProgressView() {
    app.innerHTML = `<div class="center-note">Loading progress…</div>`;
    const myTeamId = getMyTeamId();

    const [{ data: teams, error: teamsError }, { data: routes, error: routesError }] = await Promise.all([
      client.from("teams").select("id, name").order("id"),
      client.from("team_routes").select("team_id, order_index, fragment, location:locations(location_name)"),
    ]);
    if (teamsError || routesError) {
      app.innerHTML = `<div class="card"><p class="feedback error">Couldn't load the progress.</p></div>`;
      return;
    }

    app.innerHTML = `
      <div class="card">
        <p class="eyebrow">Live</p>
        <h2>Team progress</h2>
        <div id="progress-rows"></div>
      </div>
    `;

    const rowsEl = document.getElementById("progress-rows");

    function currentRouteFor(teamId, stepIndex) {
      return routes.find(r => r.team_id === teamId && r.order_index === stepIndex);
    }

    async function draw() {
      const { data: rows } = await client.from("team_progress").select("team_id, current_index, history, updated_at");
      const results = soloResults(rows, routes);
      const byTeam = Object.fromEntries((rows || []).map(r => [r.team_id, r.current_index]));
      const myStep = byTeam[myTeamId] ?? 1;

      function labelFor(route) {
        if (!route) return "Start";
        const visible = route.order_index < myStep;
        return visible && route.location && route.location.location_name
          ? route.location.location_name
          : "???";
      }

      rowsEl.innerHTML = teams.map(t => {
        const stepRaw = byTeam[t.id] ?? 1;
        const step = Math.min(stepRaw, TOTAL_STEPS);
        const pct = Math.round((Math.min(stepRaw - 1, TOTAL_STEPS) / TOTAL_STEPS) * 100);
        const label = stepRaw > TOTAL_STEPS ? "Done" : `${step}/${TOTAL_STEPS}`;

        let trail = "";
        if (stepRaw <= TOTAL_STEPS) {
          const prevRoute = stepRaw > 1 ? currentRouteFor(t.id, stepRaw - 1) : null;
          const currRoute = currentRouteFor(t.id, stepRaw);
          trail = `<div class="progress-trail">${labelFor(prevRoute)} → ${labelFor(currRoute)}</div>`;
        } else if (results[t.id]) {
          const r = results[t.id];
          const solo = r.place ? ` · solo ${formatDuration(r.ms)} (${ordinal(r.place)})` : "";
          trail = `<div class="progress-trail">Finished at ${formatClock(r.finishedAt)}${solo}</div>`;
        }

        return `
          <div class="progress-row">
            <div class="progress-name" title="${escapeHtml(t.name)}">${escapeHtml(shortTeamName(t.name))}</div>
            <div class="progress-main">
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
              ${trail}
            </div>
            <div class="progress-count">${label}</div>
          </div>
        `;
      }).join("");
    }

    await draw();

    if (progressChannel) client.removeChannel(progressChannel);
    progressChannel = client
      .channel("team-progress-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_progress" }, () => {
        if (currentView === "progress") draw();
      })
      .subscribe();
  }

  function shortTeamName(name) {
    return String(name).split(":")[0].trim();
  }

  function nameForTeam(teamId) {
    const team = (teamsCache || []).find(t => t.id === teamId);
    return team ? team.name : teamId;
  }

  function appendChatMessage(msg) {
    const log = document.getElementById("chat-log");
    if (!log) return;
    const div = document.createElement("div");
    div.className = "chat-msg" + (msg.team_id === getMyTeamId() ? " mine" : "");
    div.innerHTML = `
      <span class="chat-meta" title="${escapeHtml(nameForTeam(msg.team_id))}">${escapeHtml(shortTeamName(nameForTeam(msg.team_id)))}</span>
      <p>${escapeHtml(msg.body)}</p>
    `;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function renderChatView() {
    app.innerHTML = `<div class="center-note">Loading chat…</div>`;
    await getTeams();

    const { data: messages, error } = await client
      .from("messages")
      .select("id, team_id, body, created_at")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      app.innerHTML = `<div class="card"><p class="feedback error">Couldn't load the chat.</p></div>`;
      return;
    }

    app.innerHTML = `
      <div class="card">
        <p class="eyebrow">All teams</p>
        <h2>Chat</h2>
        <div id="chat-log" class="chat-log"></div>
        <form id="chat-form" class="chat-form">
          <input type="text" id="chat-input" placeholder="Message…" autocomplete="off" maxlength="500" required />
          <button type="submit" class="primary">Send</button>
        </form>
      </div>
    `;

    (messages || []).forEach(appendChatMessage);
    markChatRead(messages && messages.length ? messages[messages.length - 1].created_at : new Date().toISOString());

    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      input.value = "";
      await client.from("messages").insert({ team_id: getMyTeamId(), body });
    });
  }

  init();
})();
