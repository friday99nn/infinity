// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const API           = "https://friday99nn.pythonanywhere.com/infinity";
const POLL_INTERVAL = 3000;

// ─────────────────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────────────────
let login         = false;
let username      = "";
let otherName     = "";
let lastMsgCount  = 0;
let selectedFile  = null;   // the actual File object chosen by user
let selectedThumb = null;   // local object URL for preview (not sent to server)
let sending       = false;  // prevent double-sends

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const showLoading = () => $("loadingOverlay").classList.add("show");
const hideLoading = () => $("loadingOverlay").classList.remove("show");

function scrollToBottom(instant = false) {
    const area = $("chatArea");
    area.scrollTo({ top: area.scrollHeight, behavior: instant ? "instant" : "smooth" });
}

function isAtBottom() {
    const area = $("chatArea");
    return area.scrollHeight - area.scrollTop - area.clientHeight < 100;
}

function formatTime() {
    return new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
    }).toUpperCase().replace(",", "");
}

// Build a full URL from a relative server path  /infinity/images/abc.jpg
function imageUrl(path) {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return "https://friday99nn.pythonanywhere.com" + path;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function start() {
    const keyEl = $("key");
    const errEl = $("keyError");
    const key   = keyEl.value.trim();

    keyEl.classList.remove("error");
    errEl.classList.remove("show");

    if (!key) { keyEl.classList.add("error"); return; }
    if (!navigator.onLine) { alert("No internet connection."); return; }

    const fd = new FormData();
    fd.append("key", key);
    showLoading();

    const timeout = setTimeout(() => { hideLoading(); alert("Request timed out."); }, 9000);

    fetch(`${API}/start`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(data => {
            clearTimeout(timeout);
            hideLoading();

            if (data.status === "invalid") {
                keyEl.classList.add("error");
                errEl.classList.add("show");
                return;
            }

            username  = data.username;
            otherName = data.other;
            login     = true;

            $("otherName").textContent    = otherName;
            $("otherInitial").textContent = otherName.charAt(0).toUpperCase();

            $("startup").style.display = "none";
            $("app").style.display     = "flex";

            loadChat(true);   // first load
        })
        .catch(err => { clearTimeout(timeout); hideLoading(); console.error(err); });
}

document.addEventListener("DOMContentLoaded", () => {
    $("key").addEventListener("keydown", e => { if (e.key === "Enter") start(); });
    $("message").addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
});

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER ONE MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────────────────────
function renderMessage(data) {
    const isMe = (data.username === username);

    const wrapper = document.createElement("div");
    wrapper.className  = `msg-wrapper ${isMe ? "me" : "other"}`;
    wrapper.dataset.id = String(data.id || "");

    // Sender name (only for the other person)
    if (!isMe) {
        const name = document.createElement("div");
        name.className   = "msg-name";
        name.textContent = data.username;
        wrapper.appendChild(name);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // ── image ──────────────────────────────────────────────────────────────
    if (data.image) {
        const src = imageUrl(data.image);

        const imgWrap = document.createElement("div");
        imgWrap.className = "chat-img-wrap";

        // Skeleton placeholder while loading
        const skeleton = document.createElement("div");
        skeleton.className = "img-skeleton";
        imgWrap.appendChild(skeleton);

        const img = document.createElement("img");
        img.className = "chat-img";
        img.alt       = "📷 photo";

        img.onload = () => {
            skeleton.remove();
            img.style.display = "block";
        };
        img.onerror = () => {
            skeleton.textContent = "⚠️ Image failed to load";
            skeleton.style.color = "#f87171";
            skeleton.style.padding = "0.5rem";
        };

        img.style.display = "none";
        img.src = src;
        img.onclick = () => openLightbox(src);

        imgWrap.appendChild(img);
        bubble.appendChild(imgWrap);
    }

    // ── text ───────────────────────────────────────────────────────────────
    if (data.message && data.message.trim()) {
        const p = document.createElement("div");
        p.className   = "msg-text";
        p.textContent = data.message;
        bubble.appendChild(p);
    }

    // ── time + tick ────────────────────────────────────────────────────────
    const timeEl = document.createElement("div");
    timeEl.className   = "msg-time";
    timeEl.textContent = data.time;
    bubble.appendChild(timeEl);

    wrapper.appendChild(bubble);
    return wrapper;
}

// ─────────────────────────────────────────────────────────────────────────────
//  POLLING  –  fetch new messages every 3 s
// ─────────────────────────────────────────────────────────────────────────────
function loadChat(instant = false) {
    if (!login) return;

    const fd = new FormData();
    fd.append("username", username);

    fetch(`${API}/load_chat`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(messages => {
            if (messages.length === lastMsgCount) return;

            const container  = $("messages");
            const atBottom   = isAtBottom();

            // Collect IDs already rendered (including optimistic tmp_ ones)
            const existingIds = new Set(
                [...container.querySelectorAll(".msg-wrapper")].map(el => el.dataset.id)
            );

            let added = 0;
            messages.forEach(msg => {
                const sid = String(msg.id);
                if (existingIds.has(sid)) return;

                // Replace optimistic bubble if server confirmed same sequence
                // (find last tmp_ bubble from same user that has no real id yet)
                const tmpBubbles = [...container.querySelectorAll(`.msg-wrapper[data-id^="tmp_"]`)];
                const match = tmpBubbles.find(el =>
                    el.querySelector(".msg-name, .msg-text") &&
                    msg.username === username &&
                    el.dataset.id.startsWith("tmp_")
                );
                if (match) {
                    match.dataset.id = sid;  // adopt the real id
                    existingIds.add(sid);
                    return;
                }

                container.appendChild(renderMessage(msg));
                added++;
            });

            lastMsgCount = messages.length;

            if (added > 0 && (atBottom || messages.at(-1)?.username === username)) {
                scrollToBottom(instant);
            }
        })
        .catch(err => console.error("Poll error:", err));
}

setInterval(() => loadChat(), POLL_INTERVAL);

// ─────────────────────────────────────────────────────────────────────────────
//  SEND MESSAGE  –  text and/or image
// ─────────────────────────────────────────────────────────────────────────────
async function sendMessage() {
    if (sending) return;

    const msgEl   = $("message");
    const message = msgEl.value.trim();

    if (!message && !selectedFile) return;

    sending = true;
    setSendBtnState(true);

    const time   = formatTime();
    const tempId = "tmp_" + Date.now();

    // ── Optimistic render (show immediately with local thumb) ───────────────
    const tempData = {
        id:       tempId,
        username,
        message,
        image:    selectedThumb || "",  // local blob URL for instant preview
        time,
    };
    const el = renderMessage(tempData);
    $("messages").appendChild(el);
    scrollToBottom();

    // Snapshot then clear UI immediately
    const fileToSend  = selectedFile;
    const thumbToSend = selectedThumb;
    msgEl.value = "";
    clearImagePreview();

    // ── Build FormData ───────────────────────────────────────────────────────
    const fd = new FormData();
    fd.append("username", username);
    fd.append("message",  message);
    fd.append("time",     time);

    if (fileToSend) {
        // Compress image before sending
        try {
            const compressed = await compressToBlob(fileToSend, 900, 0.75);
            fd.append("image_file", compressed, "photo.jpg");
        } catch (e) {
            // fallback: send original
            fd.append("image_file", fileToSend, fileToSend.name);
        }
    }

    // ── Upload ───────────────────────────────────────────────────────────────
    fetch(`${API}/save_message`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(data => {
            // Update temp bubble with real id so poll dedup works
            el.dataset.id = String(data.id || tempId);

            // Replace local blob src with server URL
            if (data.image_url) {
                const chatImg = el.querySelector(".chat-img");
                if (chatImg) {
                    const realSrc = imageUrl(data.image_url);
                    if (thumbToSend) URL.revokeObjectURL(thumbToSend);
                    chatImg.src = realSrc;
                }
            }

            lastMsgCount++;
        })
        .catch(err => {
            console.error("Send error:", err);
            el.style.opacity = "0.5";   // mark failed message visually
        })
        .finally(() => {
            sending = false;
            setSendBtnState(false);
        });
}

function setSendBtnState(disabled) {
    const btn = $("sendBtn");
    btn.disabled = disabled;
    btn.style.opacity = disabled ? "0.5" : "1";
}

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGE SELECTION & COMPRESSION
// ─────────────────────────────────────────────────────────────────────────────
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        event.target.value = "";
        return;
    }

    // 10 MB hard limit
    if (file.size > 10 * 1024 * 1024) {
        alert("Image too large (max 10 MB). Please choose a smaller image.");
        event.target.value = "";
        return;
    }

    selectedFile  = file;
    selectedThumb = URL.createObjectURL(file);

    $("previewImg").src = selectedThumb;
    $("imagePreview").classList.add("show");

    event.target.value = "";   // allow same file again
}

// Returns a compressed Blob (JPEG)
function compressToBlob(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = e => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
                    else                 { width  = Math.round(width  * maxDim / height); height = maxDim; }
                }
                const canvas = document.createElement("canvas");
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Compression failed")),
                              "image/jpeg", quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function clearImagePreview() {
    if (selectedThumb) { URL.revokeObjectURL(selectedThumb); selectedThumb = null; }
    selectedFile = null;
    $("previewImg").src = "";
    $("imagePreview").classList.remove("show");
}

// ─────────────────────────────────────────────────────────────────────────────
//  LIGHTBOX
// ─────────────────────────────────────────────────────────────────────────────
function openLightbox(src) {
    $("lightboxImg").src = src;
    $("lightbox").classList.add("open");
    document.body.style.overflow = "hidden";
}
function closeLightbox() {
    $("lightbox").classList.remove("open");
    document.body.style.overflow = "";
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
