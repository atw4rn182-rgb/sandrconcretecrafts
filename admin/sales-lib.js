/**
 * Sales / fulfillment helpers for the admin command center.
 * Revenue = payment_status === 'paid' only (amount_total cents).
 * Week = Monday 00:00 → Sunday end (local time).
 */
(function (global) {
  "use strict";

  var DEFAULT_WEEKLY_CENTS = 30000;
  var DEFAULT_ANNUAL_CENTS = 1000000;
  var MILESTONE_KEY = "sr_sales_milestones_v1";

  function moneyFromCents(cents, currency) {
    var n = Number(cents);
    if (!isFinite(n)) n = 0;
    var cur = String(currency || "usd").toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur === "USD" ? "USD" : cur,
        maximumFractionDigits: 2,
      }).format(n / 100);
    } catch (e) {
      return "$" + (n / 100).toFixed(2);
    }
  }

  function startOfLocalDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** Monday 00:00 local for the week containing `d`. */
  function startOfWeekMonday(d) {
    var x = startOfLocalDay(d);
    var day = x.getDay(); // 0 Sun … 6 Sat
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
  }

  function endOfWeekSunday(d) {
    var start = startOfWeekMonday(d);
    var end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end;
  }

  function startOfMonth(d) {
    var x = startOfLocalDay(d);
    x.setDate(1);
    return x;
  }

  function startOfYear(d) {
    var x = startOfLocalDay(d);
    x.setMonth(0, 1);
    return x;
  }

  function weekKey(d) {
    var start = startOfWeekMonday(d);
    var y = start.getFullYear();
    var oneJan = new Date(y, 0, 1);
    var week = Math.floor((start - oneJan) / 86400000 / 7) + 1;
    return y + "-W" + String(week).padStart(2, "0");
  }

  function isPaid(order) {
    return String(order && order.payment_status || "").toLowerCase() === "paid";
  }

  function needsShipping(order) {
    if (!isPaid(order)) return false;
    if (String(order.fulfillment_method || "").toLowerCase() === "pickup") {
      return false;
    }
    return String(order.fulfillment_status || "unfulfilled").toLowerCase() === "unfulfilled";
  }

  function sumPaidCents(orders, from, to) {
    var total = 0;
    (orders || []).forEach(function (o) {
      if (!isPaid(o)) return;
      var t = new Date(o.created_at).getTime();
      if (!isFinite(t)) return;
      if (from && t < from.getTime()) return;
      if (to && t >= to.getTime()) return;
      total += Number(o.amount_total) || 0;
    });
    return total;
  }

  function countPaidOrders(orders, from, to) {
    var n = 0;
    (orders || []).forEach(function (o) {
      if (!isPaid(o)) return;
      var t = new Date(o.created_at).getTime();
      if (!isFinite(t)) return;
      if (from && t < from.getTime()) return;
      if (to && t >= to.getTime()) return;
      n += 1;
    });
    return n;
  }

  function buildSalesSnapshot(orders, now) {
    now = now || new Date();
    var todayStart = startOfLocalDay(now);
    var tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var weekStart = startOfWeekMonday(now);
    var weekEnd = endOfWeekSunday(now);
    var monthStart = startOfMonth(now);
    var yearStart = startOfYear(now);

    var paid = (orders || []).filter(isPaid);
    var needs = paid.filter(needsShipping);

    return {
      now: now,
      weekStart: weekStart,
      weekEnd: weekEnd,
      weekKey: weekKey(now),
      year: now.getFullYear(),
      revenue: {
        today: sumPaidCents(paid, todayStart, tomorrow),
        week: sumPaidCents(paid, weekStart, weekEnd),
        month: sumPaidCents(paid, monthStart, null),
        year: sumPaidCents(paid, yearStart, null),
        all: sumPaidCents(paid, null, null),
      },
      orderCounts: {
        week: countPaidOrders(paid, weekStart, weekEnd),
        month: countPaidOrders(paid, monthStart, null),
        year: countPaidOrders(paid, yearStart, null),
        all: paid.length,
      },
      needsShipping: needs,
      needsShippingCount: needs.length,
      paidOrders: paid,
    };
  }

  function pct(current, goal) {
    var g = Number(goal) || 0;
    if (g <= 0) return 0;
    var p = (Number(current) || 0) / g * 100;
    if (p < 0) return 0;
    if (p > 100) return 100;
    return Math.round(p * 10) / 10;
  }

  function normalizeGoals(raw) {
    var weekly = Number(raw && raw.weekly_cents);
    var annual = Number(raw && raw.annual_cents);
    if (!isFinite(weekly) || weekly < 0) weekly = DEFAULT_WEEKLY_CENTS;
    if (!isFinite(annual) || annual < 0) annual = DEFAULT_ANNUAL_CENTS;
    return {
      weekly_cents: Math.round(weekly),
      annual_cents: Math.round(annual),
    };
  }

  function seriesDaily(orders, days, now) {
    now = now || new Date();
    var end = startOfLocalDay(now);
    end.setDate(end.getDate() + 1);
    var start = startOfLocalDay(now);
    start.setDate(start.getDate() - (days - 1));
    var buckets = [];
    for (var i = 0; i < days; i++) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var next = new Date(day);
      next.setDate(day.getDate() + 1);
      buckets.push({
        date: day,
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        cents: sumPaidCents(orders, day, next),
      });
    }
    return buckets;
  }

  function seriesMonthly(orders, now) {
    now = now || new Date();
    var year = now.getFullYear();
    var months = [];
    for (var m = 0; m < 12; m++) {
      var from = new Date(year, m, 1);
      var to = new Date(year, m + 1, 1);
      months.push({
        date: from,
        label: from.toLocaleDateString(undefined, { month: "short" }),
        cents: sumPaidCents(orders, from, to),
      });
    }
    return months;
  }

  function aggregateCustomers(orders) {
    var map = {};
    (orders || []).filter(isPaid).forEach(function (o) {
      var email = String(o.customer_email || "").trim().toLowerCase();
      var key = email || "id:" + o.id;
      if (!map[key]) {
        map[key] = {
          key: key,
          email: email || null,
          name: o.customer_name || null,
          phone: o.customer_phone || null,
          order_count: 0,
          total_spent_cents: 0,
          first_order_at: o.created_at,
          last_order_at: o.created_at,
          orders: [],
        };
      }
      var c = map[key];
      c.order_count += 1;
      c.total_spent_cents += Number(o.amount_total) || 0;
      if (o.customer_name && !c.name) c.name = o.customer_name;
      if (o.customer_phone && !c.phone) c.phone = o.customer_phone;
      if (new Date(o.created_at) < new Date(c.first_order_at)) {
        c.first_order_at = o.created_at;
      }
      if (new Date(o.created_at) > new Date(c.last_order_at)) {
        c.last_order_at = o.created_at;
      }
      c.orders.push(o);
    });
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return new Date(b.last_order_at) - new Date(a.last_order_at);
      });
  }

  function loadMilestones() {
    try {
      var raw = localStorage.getItem(MILESTONE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveMilestones(data) {
    try {
      localStorage.setItem(MILESTONE_KEY, JSON.stringify(data || {}));
    } catch (e) {
      /* ignore quota */
    }
  }

  /**
   * Returns newly crossed milestones that have not been acknowledged for
   * this year (annual) or this week (weekly). Does not mark them yet.
   */
  function pendingCelebrations(snap, goals) {
    var store = loadMilestones();
    var annualPct = pct(snap.revenue.year, goals.annual_cents);
    var weeklyPct = pct(snap.revenue.week, goals.weekly_cents);
    var thresholds = [25, 50, 75, 100];
    var out = [];

    var annualAck = (store.annual && store.annual[String(snap.year)]) || {};
    thresholds.forEach(function (t) {
      if (annualPct >= t && !annualAck[String(t)]) {
        out.push({ scope: "annual", threshold: t, pct: annualPct });
      }
    });

    var weekAck = (store.weekly && store.weekly[snap.weekKey]) || {};
    thresholds.forEach(function (t) {
      if (weeklyPct >= t && !weekAck[String(t)]) {
        out.push({ scope: "weekly", threshold: t, pct: weeklyPct });
      }
    });

    return out;
  }

  function acknowledgeCelebrations(snap, celebrations) {
    var store = loadMilestones();
    if (!store.annual) store.annual = {};
    if (!store.weekly) store.weekly = {};
    (celebrations || []).forEach(function (c) {
      if (c.scope === "annual") {
        if (!store.annual[String(snap.year)]) store.annual[String(snap.year)] = {};
        store.annual[String(snap.year)][String(c.threshold)] = true;
      }
      if (c.scope === "weekly") {
        if (!store.weekly[snap.weekKey]) store.weekly[snap.weekKey] = {};
        store.weekly[snap.weekKey][String(c.threshold)] = true;
      }
    });
    saveMilestones(store);
  }

  function prefersReducedMotion() {
    try {
      return !!(
        global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function animateNumber(el, toCents, opts) {
    opts = opts || {};
    var currency = opts.currency || "usd";
    var duration = opts.duration == null ? 900 : opts.duration;
    var reduced = prefersReducedMotion() || opts.skip;
    if (!el) return Promise.resolve();
    if (reduced) {
      el.textContent = moneyFromCents(toCents, currency);
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var start = performance.now();
      var from = 0;
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var val = Math.round(from + (toCents - from) * eased);
        el.textContent = moneyFromCents(val, currency);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function animateBar(el, pctValue, opts) {
    opts = opts || {};
    var duration = opts.duration == null ? 900 : opts.duration;
    var reduced = prefersReducedMotion() || opts.skip;
    if (!el) return Promise.resolve();
    var target = Math.max(0, Math.min(100, Number(pctValue) || 0));
    if (reduced) {
      el.style.width = target + "%";
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      el.style.width = "0%";
      // force reflow
      void el.offsetWidth;
      el.style.transition = "width " + duration + "ms cubic-bezier(0.4,0,0.2,1)";
      el.style.width = target + "%";
      setTimeout(resolve, duration + 40);
    });
  }

  global.SRSales = {
    DEFAULT_WEEKLY_CENTS: DEFAULT_WEEKLY_CENTS,
    DEFAULT_ANNUAL_CENTS: DEFAULT_ANNUAL_CENTS,
    moneyFromCents: moneyFromCents,
    startOfWeekMonday: startOfWeekMonday,
    endOfWeekSunday: endOfWeekSunday,
    weekKey: weekKey,
    isPaid: isPaid,
    needsShipping: needsShipping,
    buildSalesSnapshot: buildSalesSnapshot,
    pct: pct,
    normalizeGoals: normalizeGoals,
    seriesDaily: seriesDaily,
    seriesMonthly: seriesMonthly,
    aggregateCustomers: aggregateCustomers,
    pendingCelebrations: pendingCelebrations,
    acknowledgeCelebrations: acknowledgeCelebrations,
    prefersReducedMotion: prefersReducedMotion,
    animateNumber: animateNumber,
    animateBar: animateBar,
  };
})(typeof window !== "undefined" ? window : globalThis);
