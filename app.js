let i = 0, d = 0, c = 0, s = 0, t = 0, b = 0;
let max = 101;

const apuntarBtn = document.getElementById("apuntar");
const menos10Btn = document.getElementById("menos10");

const textViews = [
    document.getElementById("puntuacion1"),
    document.getElementById("puntuacion2"),
    document.getElementById("puntuacion3"),
    document.getElementById("puntuacion4"),
    document.getElementById("puntuacion5"),
    document.getElementById("puntuacion6"),
    document.getElementById("puntuacion7"),
    document.getElementById("puntuacion8"),
    document.getElementById("puntuacion9")
];

const editTexts = [
    document.getElementById("edit1"),
    document.getElementById("edit2"),
    document.getElementById("edit3"),
    document.getElementById("edit4"),
    document.getElementById("edit5"),
    document.getElementById("edit6"),
    document.getElementById("edit7"),
    document.getElementById("edit8"),
    document.getElementById("edit9")
];

const nombres = [
    document.getElementById("nombre1"),
    document.getElementById("nombre2"),
    document.getElementById("nombre3"),
    document.getElementById("nombre4"),
    document.getElementById("nombre5"),
    document.getElementById("nombre6"),
    document.getElementById("nombre7"),
    document.getElementById("nombre8"),
    document.getElementById("nombre9")
];

const r = [
    document.getElementById("r1"),
    document.getElementById("r2"),
    document.getElementById("r3"),
    document.getElementById("r4"),
    document.getElementById("r5"),
    document.getElementById("r6"),
    document.getElementById("r7"),
    document.getElementById("r8"),
    document.getElementById("r9")
];

let ren = new Array(9).fill(false);

function A(m10) {
    if (i === 0) {
        apuntarBtn.textContent = "Siguiente";
        editTexts[i].value = "";
        editTexts[i].focus();
    } else if (i > 0) {
        let a = parseInt(textViews[i - 1].textContent || "0", 10);
        if (m10) {
            b = -10;
        } else {
            b = parseInt(editTexts[i - 1].value || "0", 10);
        }

        c = a + b;

        if (c < max && c > d) {
            d = c;
        }

        textViews[i - 1].textContent = c.toString();

        if (nombres[i].value !== "") {
            editTexts[i].value = "";
            editTexts[i].focus();
        } else {
            apuntarBtn.textContent = "Apuntar ronda";
            i--;

            while (i !== -1) {
                let f = parseInt(textViews[i].textContent || "0", 10);
                if (f >= max) {
                    textViews[i].textContent = d.toString();
                    r[i].textContent += "·";
                } else {
                    s++;
                    t = i;
                }
                i--;
            }

            if (s === 1) {
                textViews[t].textContent = "Ganador";
            }

            for (let j = 0; j < ren.length; j++) {
                ren[j] = false;
            }

            c = 0;
            d = 0;
            s = 0;
            t = 0;
        }
    }

    i++;
}

function Menos10() {
    A(true);
}

function Apuntar() {
    A(false);
}

apuntarBtn.addEventListener("click", Apuntar);
menos10Btn.addEventListener("click", Menos10);
