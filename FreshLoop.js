/* ===== 1. APP STATE ===== */
var posts = [];       // populated by GET /listings
var filter = "All";   // which filter chip is selected
var meals = 0;        // meals rescued counter (loaded from /meals)

/* ===== 2. HELPER FUNCTIONS ===== */
var $ = function(i) {
  var el = document.getElementById(i);
  if (!el && i === "submit") el = document.getElementById("publish");
  if (!el && i === "publish") el = document.getElementById("submit");
  return el;
};

// Badge color: 1 hour or less = red, up to 4 hours = amber, otherwise green
function urg(h) { return h <= 1 ? "hot" : h <= 4 ? "warm" : ""; }

// Badge text: "Expires within 1 hour" or "Safe for 3 hours"
function lbl(h) { return h === 1 ? "Expires within 1 hour" : "Safe for " + h + " hours"; }

// Escape HTML for template strings
function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

// Clock time when food stops being safe
function safeUntil(h) { return new Date(Date.now() + h * 3600000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

// Small message popup
function toast(m) {
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(function() {
    if (t.remove) {
      t.remove();
    } else if (t.parentNode) {
      t.parentNode.removeChild(t);
    }
  }, 2200);
}

function listingTags(post) {
  var tags = (post.dietary_tags || post.tags || []).filter(function(tag) {
    return tag.toLowerCase() !== "vegetarian";
  });
  if (post.vegetarian === "yes") tags.push("Vegetarian");
  var calories = post.calories_per_serving;
  if (calories) {
    var range = calories.low === calories.high ? calories.low : calories.low + "–" + calories.high;
    tags.push("Estimated " + range + " calories per serving");
  }
  return tags;
}

function formatPickupDeadline(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  var date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

/* ===== 3. RENDER THE FEED =====
   Builds cards from posts array using textContent for text fields. */
function render() {
  var feed = $("feed");
  feed.innerHTML = "";

  var list = posts.filter(function(p) {
    if (filter === "Vegetarian") return p.vegetarian === "yes";
    var tags = p.dietary_tags || p.tags || [];
    return filter === "All" || tags.indexOf(filter) > -1;
  });

  if (!list.length) {
    var emptyDiv = document.createElement("div");
    emptyDiv.className = "empty";
    emptyDiv.textContent = "No posts match this filter yet. Be the first to post food.";
    feed.appendChild(emptyDiv);
    return;
  }

  list.forEach(function(p) {
    var i = posts.indexOf(p);
    var article = document.createElement("article");
    article.className = p.fresh ? "listing-card new" : "listing-card";
    article.setAttribute("data-open", i);
    article.tabIndex = 0;

    var titleVal = p.title || (p.items && p.items[0] && p.items[0].name) || "Surplus Food";
    var servVal = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : p.serv);
    var addrVal = p.pickupAddress !== undefined && p.pickupAddress !== null ? p.pickupAddress : (p.pickup_address !== undefined && p.pickup_address !== null ? p.pickup_address : p.addr);
    var deadlineVal = p.pickupDeadline !== undefined && p.pickupDeadline !== null ? p.pickupDeadline : (p.pickup_deadline !== undefined && p.pickup_deadline !== null ? p.pickup_deadline : p.deadline);
    var orgVal = p.donor_name || p.org || "Community Donor";
    var whereVal = p.where || (p.lat && p.lng ? p.lat.toFixed(2) + ", " + p.lng.toFixed(2) : "");
    var descVal = p.desc || p.storage_notes || "";

    // Food photo or illustration
    var photoDiv = document.createElement("div");
    photoDiv.className = "photo listing-photo";
    if (p.img) {
      photoDiv.style.backgroundImage = "url(" + p.img + ")";
    } else {
      var g = p.g || "#F5D7A1,#E9A55B";
      var parts = g.split(",");
      photoDiv.style.background = "linear-gradient(135deg," + parts[0] + "," + (parts[1] || parts[0]) + ")";
      var photoEmoji = document.createElement("span");
      photoEmoji.textContent = p.emoji || "🥐";
      photoDiv.appendChild(photoEmoji);
    }
    photoDiv.setAttribute("role", "img");
    photoDiv.setAttribute("aria-label", titleVal);

    article.appendChild(photoDiv);

    // Body area
    var bodyDiv = document.createElement("div");
    bodyDiv.className = "body";

    // Title (rendered via textContent)
    var h2 = document.createElement("h2");
    h2.textContent = titleVal;
    bodyDiv.appendChild(h2);

    var attribution = document.createElement("p");
    attribution.className = "listing-attribution";
    attribution.textContent = [orgVal, p.food_category, whereVal].filter(Boolean).join(" · ");
    bodyDiv.appendChild(attribution);

    // Description (if present)
    if (descVal) {
      var pDesc = document.createElement("p");
      pDesc.textContent = descVal;
      bodyDiv.appendChild(pDesc);
    }

    // pickupAddress (shown when present via textContent)
    if (addrVal) {
      var addrDiv = document.createElement("div");
      addrDiv.className = "addr";
      addrDiv.textContent = addrVal;
      bodyDiv.appendChild(addrDiv);
    }

    // Dietary tags and allergen warnings
    var tags = listingTags(p);
    var warn = p.allergens || p.warn || [];
    if (tags.length || warn.length) {
      var tagsDiv = document.createElement("div");
      tagsDiv.className = "tags";
      tags.forEach(function(t) {
        var tagSpan = document.createElement("span");
        tagSpan.className = "tag";
        tagSpan.textContent = t;
        tagsDiv.appendChild(tagSpan);
      });
      warn.forEach(function(w) {
        var warnSpan = document.createElement("span");
        warnSpan.className = "tag warn";
        warnSpan.textContent = w;
        tagsDiv.appendChild(warnSpan);
      });
      bodyDiv.appendChild(tagsDiv);
    }

    // Pickup deadline and servings next to Claim
    var rowDiv = document.createElement("div");
    rowDiv.className = "row listing-footer";
    var pickupInfo = document.createElement("div");

    if (deadlineVal) {
      var deadline = document.createElement("div");
      deadline.className = "listing-deadline";
      var label = document.createElement("span");
      label.textContent = "Pickup by";
      var time = document.createElement("strong");
      time.textContent = formatPickupDeadline(deadlineVal);

      if (typeof deadlineVal === "string" && /^\d{4}-\d{2}-\d{2}T/.test(deadlineVal)) {
        var minutesLeft = (Date.parse(deadlineVal) - Date.now()) / 60000;
        if (minutesLeft > 0 && minutesLeft <= 120) {
          deadline.classList.add("due-soon");
          label.textContent = "Pickup soon";
        }
      }

      deadline.appendChild(label);
      deadline.appendChild(time);
      pickupInfo.appendChild(deadline);
    }

    // Servings (shown when present via textContent)
    if (servVal !== undefined && servVal !== null && servVal !== "") {
      var metaSpan = document.createElement("span");
      metaSpan.className = "meta";
      var strServ = String(servVal);
      metaSpan.textContent = /^\d+$/.test(strServ.trim()) ? "About " + strServ.trim() + " servings" : strServ;
      pickupInfo.appendChild(metaSpan);
    }

    var claimBtn = document.createElement("button");
    claimBtn.className = "claim";
    claimBtn.setAttribute("data-i", i);
    if (p.claimed || p.status === "claimed") {
      claimBtn.disabled = true;
      claimBtn.textContent = "Claimed";
    } else {
      claimBtn.textContent = "Claim";
    }
    rowDiv.appendChild(pickupInfo);
    rowDiv.appendChild(claimBtn);

    bodyDiv.appendChild(rowDiv);
    article.appendChild(bodyDiv);

    feed.appendChild(article);
  });
}

/* ===== 4. FILTER CHIPS ===== */
function chips() {
  $("chips").innerHTML = ["All", "Vegetarian", "Halal", "Nut-free"].map(function(c) {
    return '<button class="chip" aria-pressed="' + (c === filter) + '" data-c="' + c + '">' + c + '</button>';
  }).join("");
}

$("chips").onclick = function(e) {
  var c = e.target.getAttribute("data-c");
  if (c) {
    filter = c;
    chips();
    render();
  }
};

/* ===== 5. CLAIM + DETAIL VIEW ===== */
async function claim(target) {
  var p = posts[target];
  if (!p && typeof target === "string") {
    p = posts.find(function(item) { return item.id === target; });
  }
  if (!p) return;
  if (p.claimed || p.status === "claimed" || p.claiming) return;

  var listingId = p.id;
  if (!listingId) {
    p.claimed = true;
    p.status = "claimed";
    toast("Claimed! The donor has been notified.");
    render();
    return;
  }

  p.claiming = true;
  try {
    var res = await fetch("/listings/" + encodeURIComponent(listingId) + "/claim?receiver_name=Neighbor", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (res.status === 409) {
      if ($("detail") && $("detail").open) {
        $("detail").close();
      }
      toast("This listing was already claimed or is no longer available");
      await loadListings();
      return;
    }

    if (res.status === 404) {
      if ($("detail") && $("detail").open) {
        $("detail").close();
      }
      toast("Listing not found.");
      await loadListings();
      return;
    }

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      var errMsg = errData.detail || errData.error || ("Failed to claim listing (" + res.status + ")");
      toast(errMsg);
      await loadListings();
      return;
    }

    // Success (HTTP 200/201)
    p.claimed = true;
    p.status = "claimed";

    if ($("detail") && $("detail").open) {
      $("detail").close();
    }

    toast("Claimed! The donor has been notified.");
    await Promise.all([loadListings(), loadClaimedListings()]);
  } catch (err) {
    console.error("Error claiming listing:", err);
    toast("Network error. Please try again.");
  } finally {
    p.claiming = false;
  }
}

window.claim = claim;

function openDetail(i) {
  var p = posts[i];
  if (!p) return;

  var title = p.title || (p.items && p.items[0] && p.items[0].name) || "Surplus Food";
  var desc = p.desc || p.storage_notes || "";
  var addr = p.pickupAddress !== undefined && p.pickupAddress !== null ? p.pickupAddress : (p.pickup_address !== undefined && p.pickup_address !== null ? p.pickup_address : p.addr);
  var serv = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : (p.serv || 0));
  var deadline = p.pickupDeadline !== undefined && p.pickupDeadline !== null ? p.pickupDeadline : (p.pickup_deadline !== undefined && p.pickup_deadline !== null ? p.pickup_deadline : p.deadline);
  var hrs = p.safe_hours || p.hrs || 3;
  var until = formatPickupDeadline(deadline) || p.until || safeUntil(hrs);
  var org = p.donor_name || p.org || "Community Donor";
  var where = p.where || (p.lat && p.lng ? p.lat.toFixed(2) + ", " + p.lng.toFixed(2) : "");
  var tags = listingTags(p);
  if (p.food_category) tags.unshift(p.food_category);
  var warn = p.allergens || p.warn || [];

  var gParts = (p.g || "#F5D7A1,#E9A55B").split(",");
  var bg = p.img ? 'background-image:url(' + p.img + ')' : 'background:linear-gradient(135deg,' + gParts[0] + ',' + (gParts[1] || gParts[0]) + ')';

  var map = addr ? '<iframe class="map" title="Map of the pickup location" loading="lazy" src="https://maps.google.com/maps?q=' + encodeURIComponent(addr) + '&z=15&output=embed"></iframe><div class="addr"><span>' + esc(addr) + '</span><a class="dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr) + '">Get directions</a></div>' : '<div class="nomap">No pickup address was added to this post.</div>';

  $("detailBody").innerHTML =
    '<div class="photo big" style="' + bg + '" role="img" aria-label="' + esc(title) + '">' + (p.img ? "" : (p.emoji || "🥐")) + '<span class="badge ' + urg(hrs) + '"><i></i>' + lbl(hrs) + '</span></div>' +
    '<div class="dbody">' +
    '<div class="who flush"><div class="av">' + (p.av || "🥐") + '</div><div><b>' + esc(org) + '</b><span>' + esc(where) + '</span></div></div>' +
    '<h2>' + esc(title) + '</h2><p class="desc">' + esc(desc) + '</p>' +
    (p.ingredients_text ? '<p class="desc"><strong>Ingredients from label</strong><br>' + esc(p.ingredients_text) + '</p>' : '') +
    (p.allergen_statement ? '<p class="desc"><strong>Allergen statement from label</strong><br>' + esc(p.allergen_statement) + '</p>' : '') +
    '<div class="facts"><div><b>' + serv + '</b><span>servings</span></div><div><b>' + esc(until) + '</b><span>pickup deadline</span></div></div>' +
    '<div class="tags">' + tags.map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + warn.map(function(t) { return '<span class="tag warn">' + esc(t) + '</span>'; }).join("") + '</div>' +
    map +
    '<button class="claim wide" data-d="' + i + '"' + ((p.claimed || p.status === "claimed") ? " disabled" : "") + '>' + ((p.claimed || p.status === "claimed") ? "Claimed" : "Claim this food") + '</button></div>';

  $("detail").showModal();
}

// Click and keydown handlers for feed
$("feed").onclick = function(e) {
  var i = e.target.getAttribute("data-i");
  if (i !== null) {
    claim(i);
    return;
  }
  var a = e.target.closest("article");
  if (a) openDetail(a.getAttribute("data-open"));
};

$("feed").onkeydown = function(e) {
  if (e.key === "Enter" && e.target.tagName === "ARTICLE") {
    openDetail(e.target.getAttribute("data-open"));
  }
};

$("dclose").onclick = function() { $("detail").close(); };
$("detail").onclick = function(e) {
  if (e.target === this) { this.close(); return; }
  var d = e.target.getAttribute("data-d");
  if (d !== null) claim(d);
};

/* ===== 6. POST FORM POP-UP ===== */
var postFields = $("f").querySelectorAll(".post-field");

function updatePostFieldPreviews() {
  postFields.forEach(function(section) {
    var field = section.querySelector("input, textarea");
    var value = field.value.trim();
    section.querySelector(".field-preview").textContent =
      field.id === "deadline" ? formatPickupDeadline(value) : value;
  });
}

function localDateTimeValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

$("f").addEventListener("input", updatePostFieldPreviews);
$("f").addEventListener("invalid", function(event) {
  var section = event.target.closest(".post-field");
  if (section) section.open = true;
}, true);

var photo = null;
var photoRequest = 0;
var categoryEdited = false;
var caloriesEdited = false;
var calorieServingCount = null;
var labelFields = {ingredients_text: "ingredients", allergen_statement: "allergen statement"};
var labelEdits = {};

Object.keys(labelFields).forEach(function(id) {
  $(id).oninput = function() { labelEdits[id] = true; };
});

function updateCalorieReview() {
  var needsReview = calorieServingCount !== null &&
    Number($("serv").value) !== calorieServingCount &&
    Boolean($("calLow").value || $("calHigh").value);
  $("calReview").hidden = !needsReview;
  return needsReview;
}

function confirmCalories() {
  calorieServingCount = Number($("serv").value);
  updateCalorieReview();
}

function editCalories() {
  caloriesEdited = true;
  confirmCalories();
}

$("serv").addEventListener("input", updateCalorieReview);
$("calLow").oninput = editCalories;
$("calHigh").oninput = editCalories;
$("calConfirm").onclick = confirmCalories;

$("category").onchange = function() { categoryEdited = true; };

function resetDraftHint() {
  var hintEl  = $("draftHint");
  var spinner = $("dropSpinner");
  if (hintEl)  { hintEl.textContent = ""; hintEl.style.display = "none"; hintEl.className = "draft-hint"; }
  if (spinner) { spinner.style.display = "none"; }
}

$("open").onclick = function() {
  $("f").reset();
  photo = null;
  photoRequest++;
  labelEdits = {};
  // Round up because the picker works in whole minutes.
  $("deadline").min = localDateTimeValue(new Date(Math.ceil(Date.now() / 60000) * 60000));
  postFields.forEach(function(section) { section.open = false; });
  updatePostFieldPreviews();
  categoryEdited = false;
  caloriesEdited = false;
  calorieServingCount = null;
  updateCalorieReview();
  var errEl = $("formError");
  if (errEl) {
    errEl.textContent = "";
    errEl.style.display = "none";
  }
  $("drop").className = "drop";
  $("drop").style.backgroundImage = "";
  $("dropText").textContent = "Tap to add a photo of the food";
  resetDraftHint();
  $("dlg").showModal();
};

$("cancel").onclick = function() { $("dlg").close(); resetDraftHint(); };

$("drop").onkeydown = function(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    $("file").click();
  }
};

$("file").onchange = function() {
  var f = this.files[0];
  if (!f) return;
  var request = ++photoRequest;
  var r = new FileReader();
  r.onload = function() {
    if (request !== photoRequest || !$("dlg").open) return;
    Object.keys(labelFields).forEach(function(id) {
      if (!labelEdits[id]) $(id).value = "";
    });
    if (!categoryEdited) $("category").value = "";
    if (!caloriesEdited) {
      $("calLow").value = "";
      $("calHigh").value = "";
      calorieServingCount = null;
      updateCalorieReview();
    }
    updatePostFieldPreviews();
    photo = r.result;
    $("drop").className = "drop has";
    $("drop").style.backgroundImage = "url(" + photo + ")";
    // Kick off Gemini analysis — fire and forget, never blocks the form
    analysePhoto(photo, f.type || "image/jpeg", request);
  };
  r.readAsDataURL(f);
};

/* ===== 7a. GEMINI PHOTO ANALYSIS (POST /listings/draft) ===== */
function analysePhoto(dataUrl, mimeType, request) {
  var hintEl  = $("draftHint");
  var spinner = $("dropSpinner");

  // Show spinner overlay and hint text
  if (spinner) spinner.style.display = "block";
  if (hintEl)  { hintEl.textContent = "Analysing photo\u2026"; hintEl.className = "draft-hint"; hintEl.style.display = "block"; }

  return fetch("/listings/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, mime_type: mimeType })
  })
  .then(function(res) { return res.ok ? res.json() : null; })
  .then(function(data) {
    if (request !== photoRequest || !$("dlg").open) return;
    if (spinner) spinner.style.display = "none";
    if (!data || data.source !== "gemini") {
      if (hintEl) hintEl.style.display = "none";
      return;
    }

    var prefilled = [];

    // Prefill title only when the field is still blank
    var titleEl = $("title");
    if (data.title && titleEl && !titleEl.value.trim()) {
      titleEl.value = data.title;
      prefilled.push("title");
    }

    // Prefill servings only when the field still holds the default (10)
    var servEl = $("serv");
    if (data.servings && servEl) {
      var current = parseInt(servEl.value, 10);
      if (!servEl.value.trim() || current === 10) {
        servEl.value = String(data.servings);
        prefilled.push("servings");
      }
    }

    var categoryEl = $("category");
    if (!categoryEdited && data.food_category &&
        Array.from(categoryEl.options).some(function(option) { return option.value === data.food_category; })) {
      categoryEl.value = data.food_category;
      prefilled.push("food category");
    }

    if (!caloriesEdited && data.calories_per_serving && data.servings) {
      $("calLow").value = String(data.calories_per_serving.low);
      $("calHigh").value = String(data.calories_per_serving.high);
      calorieServingCount = data.servings;
      prefilled.push("calorie estimate");
    }
    updateCalorieReview();

    var copiedLabelText = false;
    Object.keys(labelFields).forEach(function(id) {
      if (!labelEdits[id] && data[id]) {
        $(id).value = data[id];
        copiedLabelText = true;
        prefilled.push(labelFields[id]);
      }
    });

    updatePostFieldPreviews();
    if (hintEl) {
      if (prefilled.length) {
        hintEl.textContent = "\u2713 Gemini suggested " + prefilled.join(" & ") + (copiedLabelText ? " \u2014 check the copied text against the package label" : " \u2014 edit freely");
        hintEl.className = "draft-hint ok";
      } else {
        hintEl.style.display = "none";
      }
    }
  })
  .catch(function() {
    if (request !== photoRequest || !$("dlg").open) return;
    // Fail silently — form is already usable
    if (spinner) spinner.style.display = "none";
    if (hintEl)  hintEl.style.display = "none";
  });
}

/* ===== 7. PUBLISH LISTING (POST /listings) ===== */
$("f").onsubmit = async function(e) {
  if (e && e.preventDefault) e.preventDefault();

  var errEl = $("formError");
  if (errEl) {
    errEl.textContent = "";
    errEl.style.display = "none";
  }

  var title = ($("title") ? $("title").value : "").trim();
  var servStr = ($("serv") ? $("serv").value : "").trim();
  var addr = ($("addr") ? $("addr").value : "").trim();
  var deadlineEl = $("deadline");
  var pickupTime = new Date(deadlineEl.value);
  if (Number.isNaN(pickupTime.getTime()) ||
      localDateTimeValue(pickupTime) !== deadlineEl.value ||
      pickupTime.getTime() <= Date.now()) {
    deadlineEl.closest(".post-field").open = true;
    if (errEl) {
      errEl.textContent = "Choose a valid pickup date and time in the future.";
      errEl.style.display = "block";
    }
    deadlineEl.focus();
    return;
  }
  var deadline = pickupTime.toISOString();
  var desc = ($("desc") ? $("desc").value : "").trim();
  var diet = $("diet") ? $("diet").value : "";
  var hrs = $("hrs") ? parseInt($("hrs").value, 10) : 3;

  var low = $("calLow").value;
  var high = $("calHigh").value;
  if (updateCalorieReview()) {
    $("calConfirm").focus();
    return;
  }
  var calories = low || high ? {
    low: low === "" ? null : Number(low),
    high: high === "" ? null : Number(high)
  } : null;

  var payload = {
    title: title,
    calories_per_serving: calories,
    ingredients_text: $("ingredients_text").value.trim() || null,
    allergen_statement: $("allergen_statement").value.trim() || null,
    servings: servStr ? parseInt(servStr, 10) : null,
    serving_count: servStr ? parseInt(servStr, 10) : null,
    pickup_address: addr,
    pickupAddress: addr,
    pickup_deadline: deadline,
    pickupDeadline: deadline,
    deadline: deadline,
    desc: desc,
    diet: diet,
    dietary_tags: diet ? [diet] : [],
    food_category: $("category").value || null,
    vegetarian: $("vegetarian").value,
    safe_hours: hrs,
    donor_name: "You"
  };

  if (photo) {
    payload.img = photo;
  }

  try {
    var res = await fetch("/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      var errMsg = errData.detail || errData.error || errData.message || ("Failed to publish listing (" + res.status + ")");
      if (typeof errMsg === "object") {
        try { errMsg = JSON.stringify(errMsg); } catch (_) {}
      }
      if (errEl) {
        errEl.textContent = errMsg;
        errEl.style.display = "block";
      }
      toast(errMsg);
      // Keep form entries on failure!
      return;
    }

    // Success: close modal, clear form, refresh feed
    $("dlg").close();
    $("f").reset();
    photo = null;
    if ($("drop")) {
      $("drop").className = "drop";
      $("drop").style.backgroundImage = "";
      $("dropText").textContent = "Tap to add a photo of the food";
    }
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }

    await loadListings();
    toast("Listing published! Nearby receivers will be alerted.");
  } catch (err) {
    var msg = err.message || "Network error. Please try again.";
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = "block";
    }
    toast(msg);
    // Keep form entries on failure!
  }
};

/* ===== 8. FETCH LISTINGS FROM FASTAPI ===== */
function loadListings() {
  return fetch("/listings")
    .then(function(res) {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.json();
    })
    .then(function(data) {
      if (Array.isArray(data)) {
        posts = data;
        render();
      }
      return data;
    })
    .catch(function(err) {
      console.error("Failed to load listings:", err);
    });
}

window.loadListings = loadListings;

/* ===== 9. MEALS RESCUED COUNTER ===== */
function loadMeals() {
  return fetch("/meals")
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      if (data && data.meals_rescued !== undefined) {
        meals = data.meals_rescued;
        if ($("meals")) $("meals").textContent = meals.toLocaleString();
      }
    })
    .catch(function(err) { console.error("Failed to load meals:", err); });
}
window.loadMeals = loadMeals;

/* ===== 10. CLAIMED FEED ===== */
var claimedPosts = [];

function renderClaimed() {
  var feed = $("claimedFeed");
  var section = $("claimedSection");
  if (!feed) return;
  feed.innerHTML = "";
  if (!claimedPosts.length) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  claimedPosts.forEach(function(p) {
    var article = document.createElement("article");

    var titleVal = p.title || "Surplus Food";
    var addrVal = p.pickupAddress !== undefined && p.pickupAddress !== null ? p.pickupAddress : (p.pickup_address !== undefined && p.pickup_address !== null ? p.pickup_address : (p.addr || ""));
    var deadlineVal = p.pickupDeadline !== undefined && p.pickupDeadline !== null ? p.pickupDeadline : (p.pickup_deadline !== undefined && p.pickup_deadline !== null ? p.pickup_deadline : (p.deadline || ""));
    var servVal = p.servings !== undefined && p.servings !== null ? p.servings : (p.est_servings !== undefined && p.est_servings !== null ? p.est_servings : (p.serv !== undefined ? p.serv : ""));
    var orgVal = p.donor_name || p.org || "Community Donor";

    // .who row
    var who = document.createElement("div");
    who.className = "who";
    var av = document.createElement("div");
    av.className = "av";
    av.textContent = p.av || "🥐";
    who.appendChild(av);
    var whoText = document.createElement("div");
    var b = document.createElement("b");
    b.textContent = orgVal;
    whoText.appendChild(b);
    who.appendChild(whoText);
    article.appendChild(who);

    // .body
    var body = document.createElement("div");
    body.className = "body";

    var h2 = document.createElement("h2");
    h2.textContent = titleVal;
    body.appendChild(h2);

    if (addrVal) {
      var addrDiv = document.createElement("div");
      addrDiv.className = "addr";
      addrDiv.textContent = addrVal;
      body.appendChild(addrDiv);
    }

    if (deadlineVal) {
      var dlDiv = document.createElement("div");
      dlDiv.className = "deadline";
      dlDiv.textContent = "Pickup by: " + formatPickupDeadline(deadlineVal);
      body.appendChild(dlDiv);
    }

    // Servings and pickup actions
    var row = document.createElement("div");
    row.className = "row";

    if (servVal !== "" && servVal !== undefined && servVal !== null) {
      var meta = document.createElement("span");
      meta.className = "meta";
      var strServ = String(servVal);
      meta.textContent = /^\d+$/.test(strServ.trim()) ? "About " + strServ.trim() + " servings" : strServ;
      row.appendChild(meta);
    }

    var pickupBtn = document.createElement("button");
    pickupBtn.className = "claim";
    pickupBtn.setAttribute("data-pickup-id", p.id);
    pickupBtn.textContent = "Confirm pickup";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ghost";
    cancelBtn.textContent = "Cancel pickup";
    cancelBtn.onclick = function() { cancelPickup(p, cancelBtn, pickupBtn); };

    var actions = document.createElement("div");
    actions.className = "pickup-actions";
    actions.appendChild(pickupBtn);
    actions.appendChild(cancelBtn);
    body.appendChild(row);
    body.appendChild(actions);
    article.appendChild(body);
    feed.appendChild(article);
  });
}

function loadClaimedListings() {
  return fetch("/listings/claimed")
    .then(function(res) { return res.ok ? res.json() : []; })
    .then(function(data) {
      claimedPosts = Array.isArray(data) ? data : [];
      renderClaimed();
    })
    .catch(function(err) { console.error("Failed to load claimed listings:", err); });
}
window.loadClaimedListings = loadClaimedListings;

// Wire Confirm pickup button clicks
var claimedFeedEl = $("claimedFeed");
if (claimedFeedEl) {
  claimedFeedEl.onclick = function(e) {
    var id = e.target.getAttribute("data-pickup-id");
    if (id) confirmPickup(id);
  };
}

/* ===== 11. PICKUP ACTIONS ===== */
async function cancelPickup(listing, cancelBtn, pickupBtn) {
  cancelBtn.disabled = true;
  pickupBtn.disabled = true;
  try {
    var res = await fetch("/listings/" + encodeURIComponent(listing.id) + "/cancel-pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimed_at: listing.claimed_at || listing.claimedAt || null })
    });

    if (!res.ok) {
      var error = await res.json().catch(function() { return {}; });
      toast(error.detail || "Failed to cancel pickup.");
      if (res.status === 409 || res.status === 404) {
        await Promise.all([loadClaimedListings(), loadListings(), loadMeals()]);
      }
      return;
    }

    toast("Pickup canceled.");
    await Promise.all([loadClaimedListings(), loadListings()]);
  } catch (err) {
    console.error("Error canceling pickup:", err);
    toast("Network error. Please try again.");
  } finally {
    cancelBtn.disabled = false;
    pickupBtn.disabled = false;
  }
}


async function confirmPickup(listingId) {
  try {
    var res = await fetch("/listings/" + encodeURIComponent(listingId) + "/pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (res.status === 409) {
      toast("This listing is already picked up or was never claimed");
      await Promise.all([loadClaimedListings(), loadMeals()]);
      return;
    }

    if (res.status === 404) {
      toast("Listing not found.");
      await loadClaimedListings();
      return;
    }

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      toast(errData.detail || "Failed to confirm pickup");
      return;
    }

    // Success
    toast("Pickup confirmed! Thank you for rescuing this food.");
    await Promise.all([loadClaimedListings(), loadListings(), loadMeals()]);
  } catch (err) {
    console.error("Error confirming pickup:", err);
    toast("Network error. Please try again.");
  }
}
window.confirmPickup = confirmPickup;

/* ===== 12. STARTUP ===== */
chips();
render();
Promise.all([loadListings(), loadClaimedListings(), loadMeals()]);
