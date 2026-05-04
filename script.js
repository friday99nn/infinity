let login = false;
let username = "";


function start_loading() {
    let loading = document.querySelector(".loading");
    let main = document.querySelector("main");
    let startup = document.querySelector(".startup");

    loading.style.display = "inline-block";
    main.style.filter = "blur(3px)";
    main.style.pointerEvents = "none";
    startup.style.filter = "blur(3px)";
    startup.style.pointerEvents = "none"
}

function stop_loading() {
    let loading = document.querySelector(".loading");
    let main = document.querySelector("main");
    let startup = document.querySelector(".startup");

    loading.style.display = "none";
    main.style.filter = "blur(0px)";
    main.style.pointerEvents = "auto";
    startup.style.filter = "blur(0px)";
    startup.style.pointerEvents = "auto"
}


function start() {
    let key = document.querySelector("#key");

    if (key.value.trim() == "") {
        key.style.borderBottom = "2px solid red";
        return false;
    }

    if (!navigator.onLine) {
        alert("Please, connect to the imternet.")
        return false
    }

    key.style.borderBottom = "1px solid var(--root-color)";

    let DataForm = new FormData()
    DataForm.append("key", key.value.trim());
    start_loading();
    let timeout = setTimeout(() => {
        stop_loading();
        alert("Poor Network.");
        return false
    }, 7000);

    fetch("https://friday99nn.pythonanywhere.com/infinity/start", {
        method: "POST",
        body: DataForm
    })
        .then(response => response.json())
        .then(data => {
            stop_loading();
            clearTimeout(timeout);

            if (data.status == "invalid") {
                key.style.borderBottom = "2px solid red";
                alert("invalid user key.");
                return;
            }

            username = data["username"];
            login = true;
            document.querySelector(".startup").style.display = "none";
            document.querySelector("main").style.display = "flex";
            return;
        })
        .catch(error => alert(error));
}


function load_message(data) {
    let chat = document.querySelector(".chat");

    let div = document.createElement("div");
    let h5 = document.createElement("h5");
    let p = document.createElement("p");
    let small = document.createElement("small");

    h5.innerText = data.username;
    p.innerText = data.message;
    small.innerText = data.time;

    div.appendChild(h5);
    div.appendChild(p);
    div.appendChild(small);

    if (data.username === username){
        div.style.alignSelf = "flex-end";
    }

    chat.appendChild(div);
}


function send_message() {
    let message = document.querySelector("#message").value.trim();
    if (message == "") { return };
    let time = `[ ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()} ]`;
    load_message({
        "username": username,
        "message": message,
        "time": time
    })

    console.log(typeof(time));
    document.querySelector("#message").value = "";

    let DataForm = new FormData()
    DataForm.append("username", username);
    DataForm.append("message", message);
    DataForm.append("time", time);

    fetch("https://friday99nn.pythonanywhere.com/infinity/save_message", {
        method: "POST",
        body: DataForm
    })
        .then(res => res.json())
        .then(data => {
            console.log(data);
        })
        .catch(error => console.log(error));

}


setInterval(() => {
    if (login) {
        let DataForm = new FormData();
        DataForm.append("username", username);
        fetch("https://friday99nn.pythonanywhere.com/infinity/load_chat", {
            method: "POST",
            body: DataForm
        })
            .then(res => res.json())
            .then(data => {
                let divs = document.querySelectorAll(".chat div");
                divs.forEach(div=> div.remove());
                data.forEach(chat => {
                    load_message(chat);
                });
            })
            .catch(error => console.log(error));
    }
}, 3000);
