(() => {
  // --- Supabase configuration ---
  const SUPABASE_URL = "https://dhcohqbbnlfkjpihoqop.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_6yOHVUYtYfCciLGBRRuQLg_-L8W74ft";

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const TEAM_KEY = "team-hunt:team_id";
  const TOTAL_STEPS = 10;

  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const navHunt = document.getElementById("nav-hunt");
  const navProgress = document.getElementById("nav-progress");

  let currentView = "hunt";
  let progressChannel = null;

  navHunt.addEventListener("click", () => switchView("hunt"));
  navProgress.addEventListener("click", () => switchView("progress"));

  function switchView(view) {
    currentView = view;
    navHunt.setAttribute("aria-current", String(view === "hunt"));
    navProgress.setAttribute("aria-current", String(view === "progress"));
    if (view === "hunt") renderHunt();
    else renderProgressView();
  }

  function getMyTeamId() {
    return localStorage.getItem(TEAM_KEY);
  }

  async function init() {
    const teamId = getMyTeamId();
    if (!teamId) {
      await renderTeamPicker();
    } else {
      nav.hidden = false;
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

    if (step > TOTAL_STEPS) {
      app.innerHTML = `
        <div class="card">
          <p class="eyebrow">Route complete</p>
          <h2>Head to dinner!</h2>
          <p>All puzzles solved — well done, team!</p>
        </div>
      `;
      return;
    }

    const { data: route, error: routeError } = await client
      .from("team_routes")
      .select("code, location:locations(title, riddle_text, location_hint, image_url)")
      .eq("team_id", teamId)
      .eq("order_index", step)
      .maybeSingle();

    if (routeError || !route) {
      app.innerHTML = `<div class="card"><p class="feedback error">Step not found right now, try again or let the organizer know.</p></div>`;
      return;
    }

    const puzzle = route.location;

    app.innerHTML = `
      <div class="card">
        <p class="eyebrow">Step ${step} / ${TOTAL_STEPS}</p>
        <h2>${puzzle.title}</h2>
        ${puzzle.image_url ? `<img src="${puzzle.image_url}" alt="" class="puzzle-image" />` : ""}
        <p>${puzzle.riddle_text}</p>
        ${puzzle.location_hint ? `<p class="muted">${puzzle.location_hint}</p>` : ""}
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
      const expected = route.code.trim().toUpperCase();
      if (!entered) return;

      if (entered !== expected) {
        feedback.innerHTML = `<p class="feedback error">Incorrect code, try again.</p>`;
        return;
      }

      submitBtn.disabled = true;
      const { data: current } = await client
        .from("team_progress")
        .select("history")
        .eq("team_id", teamId)
        .single();

      const history = (current && current.history) || [];
      history.push({ order_index: step, solved_at: new Date().toISOString() });

      const { error: updateError } = await client
        .from("team_progress")
        .update({ current_index: step + 1, history, updated_at: new Date().toISOString() })
        .eq("team_id", teamId);

      if (updateError) {
        feedback.innerHTML = `<p class="feedback error">Unstable connection, try again.</p>`;
        submitBtn.disabled = false;
        return;
      }

      feedback.innerHTML = `<p class="feedback success">Nice, on to the next step!</p>`;
      setTimeout(renderHunt, 900);
    });
  }

  async function renderProgressView() {
    app.innerHTML = `<div class="center-note">Loading progress…</div>`;
    const myTeamId = getMyTeamId();

    const [{ data: teams, error: teamsError }, { data: routes, error: routesError }] = await Promise.all([
      client.from("teams").select("id, name").order("id"),
      client.from("team_routes").select("team_id, order_index, location_id, location:locations(location_name)"),
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

    function knownLocationIdsFor(teamId, stepIndex) {
      const ids = new Set();
      for (const r of routes) {
        if (r.team_id === teamId && r.order_index < stepIndex) {
          ids.add(r.location_id);
        }
      }
      return ids;
    }

    async function draw() {
      const { data: rows } = await client.from("team_progress").select("team_id, current_index");
      const byTeam = Object.fromEntries((rows || []).map(r => [r.team_id, r.current_index]));
      const myStep = byTeam[myTeamId] ?? 1;
      const myKnownLocationIds = knownLocationIdsFor(myTeamId, myStep);

      rowsEl.innerHTML = teams.map(t => {
        const stepRaw = byTeam[t.id] ?? 1;
        const step = Math.min(stepRaw, TOTAL_STEPS);
        const pct = Math.round((Math.min(stepRaw - 1, TOTAL_STEPS) / TOTAL_STEPS) * 100);
        const label = stepRaw > TOTAL_STEPS ? "Done" : `${step}/${TOTAL_STEPS}`;

        let hint = "";
        if (stepRaw <= TOTAL_STEPS) {
          const targetRoute = currentRouteFor(t.id, stepRaw);
          const alreadyKnown = targetRoute && myKnownLocationIds.has(targetRoute.location_id);
          if (alreadyKnown && targetRoute.location && targetRoute.location.location_name) {
            hint = `<div class="progress-hint">📍 ${targetRoute.location.location_name}</div>`;
          }
        }

        return `
          <div class="progress-row">
            <div class="progress-name">${t.name}</div>
            <div class="progress-main">
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
              ${hint}
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

  init();
})();
