/* ============================================================
   Secret Chat UI Kit — демо-логика
   Фильтры, поиск, переключение чата, отправка сообщения,
   таймер самоуничтожения.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Фильтры + поиск (телефон и десктоп независимы) ---------- */
  const scopes = ["phone", "desk"];

  const state = {
    phone: { filter: "all", query: "" },
    desk: { filter: "all", query: "" }
  };

  function applyFilters(scope) {
    const list = $(`[data-list="${scope}"]`);
    if (!list) return;

    const { filter, query } = state[scope];
    const rows = $$("[data-name]", list);

    rows.forEach((row) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && row.dataset.unread) ||
        (filter === "fav" && row.dataset.fav);

      const haystack = row.textContent.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      row.hidden = !(matchesFilter && matchesQuery);
    });
  }

  scopes.forEach((scope) => {
    const tabs = $(`[data-filters="${scope}"]`);
    if (tabs) {
      tabs.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-filter]");
        if (!tab) return;
        $$(".tab", tabs).forEach((t) => t.classList.toggle("is-active", t === tab));
        state[scope].filter = tab.dataset.filter;
        applyFilters(scope);
      });
    }

    const search = $(`[data-search="${scope}"]`);
    if (search) {
      search.addEventListener("input", () => {
        state[scope].query = search.value.trim().toLowerCase();
        applyFilters(scope);
      });
    }
  });

  /* ---------- Переключение активного чата (десктоп) ---------- */
  const deskList = $('[data-list="desk"]');
  const peerName = $("#peerName");
  const peerStatus = $("#peerStatus");
  const peerAvatar = $("#peerAvatar");

  if (deskList && peerName) {
    deskList.addEventListener("click", (event) => {
      const row = event.target.closest(".d-row");
      if (!row) return;

      $$(".d-row", deskList).forEach((r) => r.classList.toggle("is-active", r === row));

      peerName.textContent = row.dataset.name + " ";
      peerName.insertAdjacentHTML(
        "beforeend",
        '<svg class="ic ic--13 lock"><use href="#i-lock-solid"/></svg>'
      );
      peerStatus.textContent = row.dataset.status || "";
      if (row.dataset.avatar) {
        peerAvatar.src = `./assets/avatars/${row.dataset.avatar}.svg`;
      }
    });
  }

  /* ---------- Отправка сообщения ---------- */
  const composer = $("#composer");
  const input = $("#messageInput");
  const canvasInner = $(".canvas__inner");
  const canvas = $("#canvas");

  if (composer && input && canvasInner) {
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const time = new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const msg = document.createElement("div");
      msg.className = "msg msg--out";
      msg.innerHTML = `
        <div class="bubble">
          <p class="bubble__text"></p>
          <span class="bubble__meta">${time}
            <svg class="ic ic--14 tick"><use href="#i-check-double"/></svg>
          </span>
        </div>`;
      $(".bubble__text", msg).textContent = text;
      $(".bubble__text", msg).insertAdjacentHTML(
        "beforeend",
        ' <svg class="ic ic--14 bubble__lock"><use href="#i-lock-solid"/></svg>'
      );

      canvasInner.appendChild(msg);
      input.value = "";
      canvas.scrollTop = canvas.scrollHeight;
    });
  }

  /* ---------- Таймер самоуничтожения ---------- */
  const ring = $("#ring");
  const ringValue = $("#ringValue");

  if (ring && ringValue && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const TOTAL = 10;
    let left = TOTAL;

    setInterval(() => {
      left = left > 1 ? left - 1 : TOTAL;
      ringValue.textContent = String(left);
      ring.style.setProperty("--p", (left / TOTAL).toFixed(3));
    }, 1000);
  }

  /* ---------- Панель информации ---------- */
  const closeInfo = $("#closeInfo");
  const info = $("#info");

  if (closeInfo && info) {
    closeInfo.addEventListener("click", () => info.classList.add("is-hidden"));
  }
})();
