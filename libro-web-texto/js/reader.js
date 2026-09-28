(() => {

    const pages = window.BOOK_PAGES || [];

    const total = pages.length;

    let current = Math.max(
        1,
        Math.min(
            total,
            Number(localStorage.getItem("jh-page") || 1)
        )
    );

    let zoom = Number(
        localStorage.getItem("jh-zoom") || 1
    );

    zoom = Math.max(
        .85,
        Math.min(1.65, zoom)
    );


    /* =========================================
       ELEMENTOS
    ========================================= */

    const stage =
        document.getElementById("bookStage");

    const book =
        document.getElementById("book");


    /* =========================================
       CANVAS
    ========================================= */

    const canvas =
        document.createElement("canvas");

    canvas.className =
        "book-canvas";

    stage.appendChild(canvas);

    const ctx =
        canvas.getContext("2d");


    /*
       Canvas utilizado para preparar
       cada página antes de deformarla.
    */

    const pageCanvas =
        document.createElement("canvas");

    const pageCtx =
        pageCanvas.getContext("2d");


    /* =========================================
       ESTADO
    ========================================= */

    let width = 0;
    let height = 0;

    let dpr = 1;

    let pageReady = false;

    let dragging = false;

    let downX = 0;
    let downY = 0;

    let currentX = 0;

    let progress = 0;

    let direction = 0;

    let busy = false;

    let animationFrame = null;


    /* =========================================
       CONFIGURACIÓN VISUAL
    ========================================= */

    const PAPER =
        "#090a0b";

    const TEXT =
        "#d0cec6";

    const MUTED =
        "#85837c";

    const EDGE =
        "#292b2e";


    /*
       Cantidad de segmentos que forman
       virtualmente la hoja.
    */

    const SEGMENTS = 50;


    /* =========================================
       REDIMENSIONAR
    ========================================= */

    function resize() {

        const rect =
            stage.getBoundingClientRect();

        width =
            Math.max(1, Math.floor(rect.width));

        height =
            Math.max(1, Math.floor(rect.height));

        dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );

        canvas.width =
            width * dpr;

        canvas.height =
            height * dpr;

        canvas.style.width =
            width + "px";

        canvas.style.height =
            height + "px";

        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        preparePageCanvas();

        drawNormalPage();
    }


    window.addEventListener(
        "resize",
        resize
    );


    /* =========================================
       PREPARAR PÁGINA
    ========================================= */

    function preparePageCanvas() {

        pageCanvas.width =
            Math.max(
                1000,
                Math.floor(width * 2)
            );

        pageCanvas.height =
            Math.max(
                1300,
                Math.floor(height * 2)
            );

        pageCtx.setTransform(
            1,
            0,
            0,
            1,
            0,
            0
        );

        pageCtx.clearRect(
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
        );

        pageCtx.fillStyle =
            PAPER;

        pageCtx.fillRect(
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
        );

        drawPageText(
            pageCtx,
            pages[current - 1] || ""
        );
    }


    /* =========================================
       DIBUJAR TEXTO
    ========================================= */

    function drawPageText(
        context,
        text
    ) {

        const w =
            pageCanvas.width;

        const h =
            pageCanvas.height;

        const paddingX =
            w * .095;

        const paddingTop =
            h * .075;

        const paddingBottom =
            h * .07;

        /*
           El tamaño se adapta a la pantalla.
        */

        let fontSize =
            Math.round(
                Math.min(
                    w * .024,
                    40
                )
            );

        /*
           En pantallas pequeñas,
           mantiene texto cómodo.
        */

        fontSize =
            Math.max(
                27,
                fontSize
            );

        fontSize *= zoom;

        context.fillStyle =
            TEXT;

        context.font =
            `${fontSize}px Georgia, "Times New Roman", serif`;

        context.textBaseline =
            "top";

        context.textAlign =
            "left";

        const lineHeight =
            fontSize * 1.65;

        const maxWidth =
            w -
            paddingX * 2;

        /*
           Conservamos los saltos
           que vienen del PDF.
        */

        const paragraphs =
            String(text)
                .replace(/\r/g, "")
                .split("\n");

        let y =
            paddingTop;

        for (
            const paragraph of paragraphs
        ) {

            /*
               Una línea vacía del PDF
               también se conserva.
            */

            if (
                paragraph.trim() === ""
            ) {

                y += lineHeight * .55;

                continue;
            }

            const words =
                paragraph.split(/\s+/);

            let line = "";

            for (
                const word of words
            ) {

                const test =
                    line
                        ? line + " " + word
                        : word;

                const metrics =
                    context.measureText(test);

                if (
                    metrics.width >
                        maxWidth &&
                    line
                ) {

                    context.fillText(
                        line,
                        paddingX,
                        y
                    );

                    y += lineHeight;

                    line = word;

                } else {

                    line = test;
                }
            }

            if (line) {

                context.fillText(
                    line,
                    paddingX,
                    y
                );

                y += lineHeight;
            }

            y += lineHeight * .35;

            /*
               Si llegamos al final,
               no dibujamos fuera.
            */

            if (
                y >
                h - paddingBottom
            ) {
                break;
            }
        }
    }


    /* =========================================
       ACTUALIZAR INTERFAZ
    ========================================= */

    function updateUI() {

        document.getElementById(
            "pageLabel"
        ).textContent =
            `Página ${current} / ${total}`;

        document.getElementById(
            "controlPage"
        ).textContent =
            current;

        const percent =
            total > 1
                ? ((current - 1) /
                    (total - 1)) * 100
                : 100;

        document.getElementById(
            "percent"
        ).textContent =
            `${Math.round(percent)}%`;

        document.getElementById(
            "progressBar"
        ).style.width =
            `${percent}%`;

        document.getElementById(
            "prevBtn"
        ).disabled =
            current <= 1 || busy;

        document.getElementById(
            "nextBtn"
        ).disabled =
            current >= total || busy;

        localStorage.setItem(
            "jh-page",
            current
        );
    }


    /* =========================================
       PÁGINA NORMAL
    ========================================= */

    function drawNormalPage() {

        if (!width || !height) {
            return;
        }

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        /*
           Fondo de la página
        */

        ctx.fillStyle =
            PAPER;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        /*
           Borde
        */

        ctx.strokeStyle =
            EDGE;

        ctx.lineWidth = 1;

        ctx.strokeRect(
            .5,
            .5,
            width - 1,
            height - 1
        );

        /*
           Página
        */

        ctx.drawImage(
            pageCanvas,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
            0,
            0,
            width,
            height
        );

        /*
           Borde interior
        */

        ctx.strokeStyle =
            "rgba(255,255,255,.025)";

        ctx.strokeRect(
            1,
            1,
            width - 2,
            height - 2
        );
    }


    /* =========================================
       SOMBRA DE LA HOJA
    ========================================= */

    function shadowGradient(
        x,
        intensity
    ) {

        const gradient =
            ctx.createLinearGradient(
                x,
                0,
                x + width * .20,
                0
            );

        gradient.addColorStop(
            0,
            `rgba(0,0,0,${.58 * intensity})`
        );

        gradient.addColorStop(
            .5,
            `rgba(0,0,0,${.20 * intensity})`
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0)"
        );

        return gradient;
    }


    /* =========================================
       CURVATURA DE LA HOJA
    ========================================= */

function drawPageTurn(p, dir) {

    p = Math.max(0, Math.min(1, p));

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /* =====================================
       PÁGINA QUE QUEDA DEBAJO
    ===================================== */

    const underneath =
        dir > 0
            ? pages[current] || ""
            : pages[current - 2] || "";


    const backCanvas =
        document.createElement("canvas");

    backCanvas.width =
        pageCanvas.width;

    backCanvas.height =
        pageCanvas.height;

    const backCtx =
        backCanvas.getContext("2d");


    backCtx.fillStyle =
        PAPER;

    backCtx.fillRect(
        0,
        0,
        backCanvas.width,
        backCanvas.height
    );


    drawPageText(
        backCtx,
        underneath
    );


    /*
       La página que queda debajo
       permanece completamente visible.
    */

    ctx.drawImage(
        backCanvas,
        0,
        0,
        backCanvas.width,
        backCanvas.height,
        0,
        0,
        width,
        height
    );


    /* =====================================
       SEGMENTOS DE LA PÁGINA ACTUAL
    ===================================== */

    const segmentWidth =
        width / SEGMENTS;


    for (
        let i = 0;
        i < SEGMENTS;
        i++
    ) {

        const u0 =
            i / SEGMENTS;

        const u1 =
            (i + 1) / SEGMENTS;


        /*
           AQUÍ ESTÁ LA CORRECCIÓN PRINCIPAL.

           Adelante:
           la hoja sale hacia la izquierda.

           Atrás:
           la hoja sale hacia la derecha.

           Antes la fórmula de atrás
           hacía que la página desapareciera
           inmediatamente.
        */

        let base0;
        let base1;


        if (dir > 0) {

            // Página siguiente
            base0 =
                (u0 - p) * width;

            base1 =
                (u1 - p) * width;

        } else {

            // Página anterior
            base0 =
                (u0 + p) * width;

            base1 =
                (u1 + p) * width;
        }


        /* =================================
           CURVATURA
        ================================= */

        /*
           La curvatura se concentra
           alrededor de la zona doblada.
        */

        const curve0 =
            Math.sin(
                u0 * Math.PI
            ) *
            Math.sin(
                p * Math.PI
            );

        const curve1 =
            Math.sin(
                u1 * Math.PI
            ) *
            Math.sin(
                p * Math.PI
            );


        const bend =
            width *
            .22 *
            Math.sin(
                p * Math.PI
            );


        /*
           La dirección de la curvatura
           también debe invertirse al volver.
        */

        const curveDirection =
            dir > 0
                ? 1
                : -1;


        const x0 =
            base0 +
            curve0 *
            bend *
            curveDirection;

        const x1 =
            base1 +
            curve1 *
            bend *
            curveDirection;


        /* =================================
           PROFUNDIDAD
        ================================= */

        const scale0 =
            1 -
            curve0 * .18;

        const scale1 =
            1 -
            curve1 * .18;


        const y0 =
            height *
            (1 - scale0) /
            2;

        const y1 =
            height *
            (1 - scale1) /
            2;


        /* =================================
           ORIGEN DE LA TEXTURA
        ================================= */

        const sx0 =
            u0 *
            pageCanvas.width;

        const sx1 =
            u1 *
            pageCanvas.width;


        /* =================================
           DIBUJAR SEGMENTO
        ================================= */

        ctx.save();


        ctx.beginPath();

        ctx.moveTo(
            x0,
            y0
        );

        ctx.lineTo(
            x1,
            y1
        );

        ctx.lineTo(
            x1,
            height - y1
        );

        ctx.lineTo(
            x0,
            height - y0
        );

        ctx.closePath();

        ctx.clip();


        /*
           IMPORTANTE:

           Siempre usamos pageCanvas.

           Es la página que el usuario
           está arrastrando.

           La página anterior/siguiente
           solamente está debajo.
        */

        ctx.drawImage(
            pageCanvas,

            sx0,
            0,
            sx1 - sx0,
            pageCanvas.height,

            x0,
            y0,
            Math.max(
                1,
                x1 - x0 + 2
            ),
            height - y0 - y1
        );


        ctx.restore();


        /* =================================
           SOMBRA DE LA CURVATURA
        ================================= */

        if (curve0 > .02) {

            const intensity =
                curve0 *
                Math.sin(
                    p * Math.PI
                );


            ctx.fillStyle =
                shadowGradient(
                    Math.min(
                        x0,
                        x1
                    ),
                    intensity
                );


            ctx.fillRect(
                Math.min(
                    x0,
                    x1
                ),
                y0,
                Math.abs(
                    x1 - x0
                ) + 5,
                height -
                y0 -
                y1
            );
        }
    }


    /* =====================================
       SOMBRA DEL DOBLEZ
    ===================================== */

    /*
       La posición del pliegue
       cambia dependiendo del sentido.
    */

    const foldX =
        dir > 0
            ? width * (1 - p)
            : width * p;


    const foldGradient =
        ctx.createLinearGradient(
            foldX - 35,
            0,
            foldX + 35,
            0
        );


    foldGradient.addColorStop(
        0,
        "rgba(0,0,0,0)"
    );

    foldGradient.addColorStop(
        .5,
        "rgba(0,0,0,.30)"
    );

    foldGradient.addColorStop(
        1,
        "rgba(255,255,255,.035)"
    );


    ctx.fillStyle =
        foldGradient;


    ctx.fillRect(
        foldX - 35,
        0,
        70,
        height
    );


    /* =====================================
       BORDE
    ===================================== */

    ctx.strokeStyle =
        EDGE;

    ctx.lineWidth = 1;


    ctx.strokeRect(
        .5,
        .5,
        width - 1,
        height - 1
    );
}
    /* =========================================
       ACTUALIZAR ANIMACIÓN
    ========================================= */

    function redraw() {

        if (
            dragging &&
            direction !== 0
        ) {

            drawPageTurn(
                progress,
                direction
            );
        }

        animationFrame =
            requestAnimationFrame(
                redraw
            );
    }


    /* =========================================
       PREPARAR CAMBIO
    ========================================= */

    function prepareTurn(dir) {

        if (
            dir > 0 &&
            current >= total
        ) {
            return false;
        }

        if (
            dir < 0 &&
            current <= 1
        ) {
            return false;
        }

        direction = dir;

        return true;
    }


    /* =========================================
       COMENZAR ARRASTRE
    ========================================= */

    function startDrag(
        x,
        y
    ) {

        if (busy) {
            return;
        }

        dragging = true;

        downX = x;
        downY = y;

        currentX = x;

        progress = 0;

        direction = 0;
    }


    /* =========================================
       MOVER EL DEDO
    ========================================= */

    function moveDrag(x,y) {

        if (!dragging || busy) {
            return;
        }

        const dx =
            x - downX;

        const dy =
            y - downY;

        /*
           Evitamos interpretar
           movimiento vertical como
           pasar página.
        */

        if (
            Math.abs(dy) >
            Math.abs(dx) * .85
        ) {
            return;
        }

        /*
           IZQUIERDA
           página siguiente
        */

        if (dx < 0) {

            if (current >= total) {
                return;
            }

            if (direction !== 1) {

                prepareTurn(1);

                prepareNextPageCanvas();
            }

            progress =
                Math.min(
                    1,
                    Math.abs(dx) /
                    width
                );
        }

        /*
           DERECHA
           página anterior
        */

        else if (dx > 0) {

            if (current <= 1) {
                return;
            }

            if (direction !== -1) {

                prepareTurn(-1);

                preparePreviousPageCanvas();
            }

            progress =
                Math.min(
                    1,
                    dx / width
                );
        }

        currentX = x;
    }


    /* =========================================
       PREPARAR SIGUIENTE PÁGINA
    ========================================= */

    let turnCanvas =
        document.createElement(
            "canvas"
        );

    let turnCtx =
        turnCanvas.getContext("2d");


    function prepareNextPageCanvas() {

        turnCanvas.width =
            pageCanvas.width;

        turnCanvas.height =
            pageCanvas.height;

        turnCtx.fillStyle =
            PAPER;

        turnCtx.fillRect(
            0,
            0,
            turnCanvas.width,
            turnCanvas.height
        );

        drawPageText(
            turnCtx,
            pages[current] || ""
        );
    }


    /* =========================================
       PREPARAR PÁGINA ANTERIOR
    ========================================= */

    function preparePreviousPageCanvas() {

        turnCanvas.width =
            pageCanvas.width;

        turnCanvas.height =
            pageCanvas.height;

        turnCtx.fillStyle =
            PAPER;

        turnCtx.fillRect(
            0,
            0,
            turnCanvas.width,
            turnCanvas.height
        );

        drawPageText(
            turnCtx,
            pages[current - 2] || ""
        );
    }


    /* =========================================
       FINALIZAR ARRASTRE
    ========================================= */

    function releaseDrag() {

        if (!dragging) {
            return;
        }

        dragging = false;

        /*
           Si pasó más del 20%,
           terminamos el giro.
        */

        const shouldTurn =
            progress >= .20;

        if (!direction) {

            drawNormalPage();

            return;
        }

        busy = true;

        const start =
            progress;

        const target =
            shouldTurn
                ? 1
                : 0;

        const duration =
            shouldTurn
                ? 260
                : 220;

        const startTime =
            performance.now();


        function animate(now) {

            const elapsed =
                now - startTime;

            const t =
                Math.min(
                    1,
                    elapsed /
                    duration
                );

            /*
               Ease-out suave.
            */

            const eased =
                1 -
                Math.pow(
                    1 - t,
                    3
                );

            progress =
                start +
                (target - start) *
                eased;

            drawPageTurn(
                progress,
                direction
            );

            if (t < 1) {

                requestAnimationFrame(
                    animate
                );

            } else {

                if (shouldTurn) {

                    current +=
                        direction;

                    current =
                        Math.max(
                            1,
                            Math.min(
                                total,
                                current
                            )
                        );
                }

                busy = false;

                direction = 0;

                progress = 0;

                preparePageCanvas();

                drawNormalPage();

                updateUI();

                document
                    .getElementById("hint")
                    .classList
                    .add("hide");
            }
        }


        requestAnimationFrame(
            animate
        );
    }


    /* =========================================
       BOTONES
    ========================================= */

    function buttonTurn(dir) {

        if (busy) {
            return;
        }

        if (
            dir > 0 &&
            current >= total
        ) {
            return;
        }

        if (
            dir < 0 &&
            current <= 1
        ) {
            return;
        }

        busy = true;

        direction = dir;

        progress = 0;

        if (dir > 0) {

            prepareNextPageCanvas();

        } else {

            preparePreviousPageCanvas();
        }

        const startTime =
            performance.now();

        const duration = 480;


        function animate(now) {

            const t =
                Math.min(
                    1,
                    (now - startTime) /
                    duration
                );

            const eased =
                1 -
                Math.pow(
                    1 - t,
                    3
                );

            progress =
                eased;

            drawPageTurn(
                progress,
                direction
            );

            if (t < 1) {

                requestAnimationFrame(
                    animate
                );

            } else {

                current += dir;

                current =
                    Math.max(
                        1,
                        Math.min(
                            total,
                            current
                        )
                    );

                busy = false;

                direction = 0;

                progress = 0;

                preparePageCanvas();

                drawNormalPage();

                updateUI();

                document
                    .getElementById("hint")
                    .classList
                    .add("hide");
            }
        }


        requestAnimationFrame(
            animate
        );
    }


    /* =========================================
       BOTONES UI
    ========================================= */

    document.getElementById(
        "nextBtn"
    ).onclick =
        () => buttonTurn(1);

    document.getElementById(
        "prevBtn"
    ).onclick =
        () => buttonTurn(-1);


    /* =========================================
       ZOOM
    ========================================= */

    function setZoom(value) {

        zoom =
            Math.max(
                .85,
                Math.min(
                    1.65,
                    value
                )
            );

        localStorage.setItem(
            "jh-zoom",
            zoom
        );

        preparePageCanvas();

        drawNormalPage();
    }


    document.getElementById(
        "zoomIn"
    ).onclick =
        () => setZoom(zoom + .10);


    document.getElementById(
        "zoomOut"
    ).onclick =
        () => setZoom(zoom - .10);


    /* =========================================
       IR A PÁGINA
    ========================================= */

    document.getElementById(
        "gotoBtn"
    ).onclick =
        () => {

            const dialog =
                document.getElementById(
                    "gotoDialog"
                );

            dialog.classList.remove(
                "hidden"
            );

            document.getElementById(
                "pageInput"
            ).value = current;
        };


    document.getElementById(
        "closeDialog"
    ).onclick =
        () => {

            document.getElementById(
                "gotoDialog"
            ).classList.add(
                "hidden"
            );
        };


    document.getElementById(
        "goBtn"
    ).onclick =
        () => {

            const value =
                Number(
                    document.getElementById(
                        "pageInput"
                    ).value
                );

            current =
                Math.max(
                    1,
                    Math.min(
                        total,
                        value || 1
                    )
                );

            preparePageCanvas();

            drawNormalPage();

            updateUI();

            document.getElementById(
                "gotoDialog"
            ).classList.add(
                "hidden"
            );
        };


    /* =========================================
       PANTALLA COMPLETA
    ========================================= */

    document.getElementById(
        "fullscreenBtn"
    ).onclick =
        async () => {

            try {

                if (
                    !document.fullscreenElement
                ) {

                    await document
                        .documentElement
                        .requestFullscreen();

                } else {

                    await document
                        .exitFullscreen();
                }

            } catch (error) {

                console.log(error);
            }
        };


    document.addEventListener(
        "fullscreenchange",
        () => {

            document.documentElement
                .classList
                .toggle(
                    "fullscreen",
                    !!document.fullscreenElement
                );

            setTimeout(
                resize,
                100
            );
        }
    );


    /* =========================================
       TECLADO
    ========================================= */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "ArrowRight" ||
                event.key === " "
            ) {

                event.preventDefault();

                buttonTurn(1);

            } else if (
                event.key === "ArrowLeft" ||
                event.key === "Backspace"
            ) {

                event.preventDefault();

                buttonTurn(-1);
            }
        }
    );


    /* =========================================
       TOUCH / MOUSE
    ========================================= */

    canvas.addEventListener(
        "pointerdown",
        event => {

            if (busy) {
                return;
            }

            canvas.setPointerCapture(
                event.pointerId
            );

            startDrag(
                event.clientX,
                event.clientY
            );
        }
    );


    canvas.addEventListener(
        "pointermove",
        event => {

            if (!dragging) {
                return;
            }

            moveDrag(
                event.clientX,
                event.clientY
            );
        }
    );


    canvas.addEventListener(
        "pointerup",
        event => {

            if (!dragging) {
                return;
            }

            releaseDrag();
        }
    );


    canvas.addEventListener(
        "pointercancel",
        () => {

            if (dragging) {

                dragging = false;

                progress = 0;

                direction = 0;

                drawNormalPage();
            }
        }
    );


    /* =========================================
       DOBLE TOQUE
    ========================================= */

    let lastTap = 0;

    canvas.addEventListener(
        "pointerup",
        event => {

            const now =
                Date.now();

            if (
                now - lastTap < 300
            ) {

                /*
                   Doble toque para zoom.
                */

                setZoom(
                    zoom > 1.1
                        ? 1
                        : 1.35
                );
            }

            lastTap = now;
        }
    );


    /* =========================================
       INICIO
    ========================================= */

    updateUI();

    resize();

    /*
       Mantiene el canvas actualizado
       y permite una respuesta fluida.
    */

    redraw();

})();