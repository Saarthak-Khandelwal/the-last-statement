const $ = (selector) =>
    document.querySelector(selector);

const bgMusic = document.getElementById("bgMusic");

if (bgMusic) {
    bgMusic.volume = 0.12;
}

function startMusic() {
    if (!bgMusic) return;

    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {
        // Browser blocked autoplay; another user interaction can start it.
    });
}

function fadeMusic(targetVolume = 0.03, duration = 1200) {
    if (!bgMusic) return;

    const startVolume = bgMusic.volume;
    const startTime = performance.now();

    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);

        bgMusic.volume =
            startVolume + (targetVolume - startVolume) * progress;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}
/* =========================================================
   SCENES
   ========================================================= */

const scenes = {

    apartment:
        "01_maras_apartment.jpg",

    hall:
        "02_apartment_hallway.jpg",

    water:
        "03_waterfront.jpg",

    interview:
        "04_police_interview_room.jpg",

    daniel:
        "05_daniels_house.jpg",

    bedroom:
        "06_maras_bedroom.jpg",

    archive:
        "07_police_archive.jpg",

    station:
        "08_old_bellweather_station.jpg",

    arthur:
        "09_arthurs_house.jpg",

    final:
        "10_final_scene.jpg"

};


/* =========================================================
   EVIDENCE
   ========================================================= */

const evidence = {

    letter: [
        "UNFINISHED LETTER",
        "Mara's final sentence stops at: “I know what I saw.”"
    ],

    clock: [
        "STOPPED CLOCK",
        "The wall clock stopped at 22:18."
    ],

    phone: [
        "LAST CALL",
        "Mara's phone shows activity after 22:18. She called police at 22:43."
    ],

    photo: [
        "SCRATCHED PHOTOGRAPH",
        "Mara, Daniel, Thomas and Clara Venn. Clara died twelve years earlier."
    ],

    audio: [
        "LENA'S RECORDING",
        "Rain, then Mara's voice: “You promised me.”"
    ],

    fingerprint: [
        "LENA'S FINGERPRINT",
        "A partial print from the overturned glass matches Lena."
    ],

    camera: [
        "SECURITY TIMESTAMP",
        "Building footage places Thomas at Mara's building at 22:26, contradicting his first statement."
    ],

    records: [
        "CLARA'S OLD CASE",
        "Clara Venn's 2014 death was ruled suicide. Large sections of the file are missing."
    ],

    email: [
        "MARA'S ARCHIVE",
        "Mara prepared evidence concerning Detective Vale shortly before her death."
    ],

    hospital: [
        "ARTHUR'S HOSPITAL RECORD",
        "Arthur Bell was admitted to hospital at 22:54."
    ],

    danielStatement: [
        "DANIEL'S STATEMENT",
        "Daniel eventually admits he confronted Mara and altered the apartment afterward."
    ]

};


/* =========================================================
   DEFAULT STATE
   ========================================================= */

function createState() {

    return {

        version: 5,

        node: "intro",

        history: [],

        evidence: [],

        dialogueLog: {},

        trust: {

            daniel: 0,

            lena: 0,

            thomas: 0

        },

        flags: {},

        choices: [],

        revealedConnections: [],

        accusation: null,

        started: false

    };

}


let state =
    createState();


let selected = 0;

let typing = false;

let typeTimer = null;

let signalTimer = null;

let selectedDialoguePerson = null;

let renderToken = 0;


/* =========================================================
   SAVE / LOAD
   ========================================================= */

function save() {

    localStorage.setItem(
        "tls-save",
        JSON.stringify(state)
    );

}


function load() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    "tls-save"
                )
            );


        if (!saved) {

            state =
                createState();

            return;
        }


        const fresh =
            createState();


        state = {

            ...fresh,

            ...saved,

            evidence:
                Array.isArray(
                    saved.evidence
                )
                    ? [
                        ...new Set(
                            saved.evidence
                        )
                    ]
                    : [],

            history:
                Array.isArray(
                    saved.history
                )
                    ? saved.history
                    : [],

            choices:
                Array.isArray(
                    saved.choices
                )
                    ? saved.choices
                    : [],
            
            revealedConnections:
                Array.isArray(
                    saved.revealedConnections
                )
                    ? saved.revealedConnections
                    : [],

            dialogueLog:
                saved.dialogueLog &&
                typeof saved.dialogueLog ===
                    "object"
                    ? saved.dialogueLog
                    : {},

            flags:
                saved.flags || {},

            trust: {

                ...fresh.trust,

                ...(saved.trust || {})

            }

        };


    } catch (error) {

        console.warn(
            "Could not load save:",
            error
        );

        state =
            createState();
    }

}


/* =========================================================
   HELPERS
   ========================================================= */

function addEvidence(key) {

    if (!key) {
        return;
    }

    if (!state.evidence.includes(key)) {

        state.evidence.push(key);
    }

}


function hasEvidence(key) {

    return state.evidence.includes(key);
}


function addFlag(key) {

    if (key) {

        state.flags[key] = true;
    }

}


function hasFlag(key) {

    return !!state.flags[key];
}


function addTrust(
    person,
    amount = 1
) {

    if (
        typeof state.trust[person] !==
        "number"
    ) {

        state.trust[person] = 0;
    }

    state.trust[person] += amount;

}


/* =========================================================
   TEXT
   ========================================================= */

function resolveText(
    text
) {

    if (
        typeof text ===
        "function"
    ) {

        return text();
    }

    return text || "";
}


/* =========================================================
   DIALOGUE LOG
   ========================================================= */

function recordDialogue(
    nodeId,
    node
) {

    if (!node) {
        return;
    }


    const speaker =
        node.speaker ||
        "UNKNOWN";


    if (
        !state.dialogueLog[speaker]
    ) {

        state.dialogueLog[speaker] = [];
    }


    const alreadyRecorded =
        state.dialogueLog[speaker]
            .some(
                entry =>
                    entry.nodeId ===
                    nodeId
            );


    if (alreadyRecorded) {

        return;
    }


    state.dialogueLog[speaker]
        .push({

            nodeId,

            text:
                resolveText(
                    node.text
                ),

            sub:
                node.sub || "",

            time:
                node.time || "",

            location:
                node.loc || ""

        });


    if (
        !selectedDialoguePerson
    ) {

        selectedDialoguePerson =
            speaker;
    }

}


/* =========================================================
   INVESTIGATION SCORE
   ========================================================= */

function investigationScore() {

    let score = 0;


    /*
     * 11 possible evidence points.
     *
     * 0–5  = surface investigation
     * 6–8  = deeper investigation
     * 9–11 = near-complete investigation
     */

    const scoredEvidence = [

        "letter",

        "clock",

        "phone",

        "photo",

        "audio",

        "fingerprint",

        "camera",

        "records",

        "email",

        "hospital",

        "danielStatement"

    ];


    scoredEvidence.forEach(
        key => {

            if (
                hasEvidence(key)
            ) {

                score++;
            }

        }
    );


    return score;
}


/* =========================================================
   ENDING RULES
   ========================================================= */

/*
 * Surface mystery:
 *
 * Who killed Mara?
 *
 * Actual culprit in this draft:
 * Daniel Venn.
 *
 * Deeper mystery:
 *
 * Why was Mara investigating Vale?
 *
 *
 * 0–5:
 * THE REPORT
 *
 * 6–8:
 * THE LAST STATEMENT
 *
 * 9–11 + Daniel accused:
 * THE MISSING PIECE
 *
 * If the player has 9–11 clues but accuses
 * someone else, they still get THE LAST STATEMENT.
 *
 * This keeps the game forgiving while making
 * the final accusation meaningful.
 */

function determineEnding() {

    const score =
        investigationScore();


    if (
        score >= 9 &&
        state.accusation ===
            "daniel"
    ) {

        return "missing_piece";
    }


    if (
        score >= 6
    ) {

        return "last_statement";
    }


    return "report";
}


/* =========================================================
   EVIDENCE CONNECTIONS
   ========================================================= */

function getConnections() {

    const connections = [];


    /*
     * Timeline
     */

    if (
        hasEvidence("clock") &&
        hasEvidence("phone")
    ) {

        connections.push({

            title:
                "TIMELINE CONTRADICTION",

            text:
                "The stopped clock does not match Mara's phone activity."

        });

    }


    /*
     * Full timeline
     */

    if (
        hasEvidence("clock") &&
        hasEvidence("phone") &&
        hasEvidence("camera")
    ) {

        connections.push({

            title:
                "TIMELINE RECONSTRUCTION",

            text:
                "The apartment timeline survives past the point suggested by the clock."

        });

    }


    /*
     * Lena
     */

    if (
        hasEvidence("audio") &&
        hasEvidence("fingerprint")
    ) {

        connections.push({

            title:
                "LENA WAS INSIDE",

            text:
                "Her denial conflicts with physical evidence from Mara's apartment."

        });

    }


    /*
     * Clara
     */

    if (
        hasEvidence("photo") &&
        hasEvidence("records")
    ) {

        connections.push({

            title:
                "CLARA'S DEATH",

            text:
                "The scratched photograph connects Mara's death to her mother's old case."

        });

    }


    /*
     * Thomas
     */

    if (
        hasEvidence("camera")
    ) {

        connections.push({

            title:
                "THOMAS'S LIE",

            text:
                "His original timeline was false."

        });

    }


    /*
     * Arthur
     */

    if (
        hasEvidence("hospital") &&
        hasEvidence("camera")
    ) {

        connections.push({

            title:
                "ARTHUR CLEARED",

            text:
                "Arthur's hospital admission creates a strong contradiction to placing him at Mara's apartment."

        });

    }


    /*
     * Vale
     */

    if (
        hasEvidence("records") &&
        hasEvidence("email")
    ) {

        connections.push({

            title:
                "MARA WAS INVESTIGATING VALE",

            text:
                "The old case and Mara's archive point toward Vale."

        });

    }


    /*
     * Daniel
     */

    if (
        hasEvidence("phone") &&
        hasEvidence("danielStatement")
    ) {

        connections.push({

            title:
                "DANIEL'S CONFRONTATION",

            text:
                "Mara's final call places her alive shortly before Daniel admits confronting her."

        });

    }


    /*
     * Deep connection
     */

    if (
        hasEvidence("records") &&
        hasEvidence("email") &&
        hasEvidence("danielStatement")
    ) {

        connections.push({

            title:
                "THE TWO MYSTERIES MERGE",

            text:
                "Mara's death, Clara's buried case, and Vale's history are no longer separate."

        });

    }


    return connections;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function go(id) {

    if (!nodes[id]) {

        console.error(
            "Missing node:",
            id
        );

        return;
    }


    state.history.push(
        state.node
    );


    state.node =
        id;


    state.choices.push(
        id
    );


    selected = 0;


    render();

    save();
}


function goBack() {

    if (
        !state.history.length
    ) {

        return;
    }


    state.node =
        state.history.pop();


    selected = 0;


    render();

    save();
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

    const node =
        nodes[state.node];


    if (!node) {

        return;
    }


    const token =
        ++renderToken;


    /*
     * Dialogue is recorded even when
     * using Back.
     *
     * Duplicates are prevented.
     */

    recordDialogue(
        state.node,
        node
    );


    /*
     * One-time node effects.
     */

    const visitKey =
        `visited:${state.node}`;


    if (
        !hasFlag(visitKey)
    ) {

        addFlag(
            visitKey
        );


        if (
            typeof node.onEnter ===
            "function"
        ) {

            node.onEnter();
        }


        if (
            node.give
        ) {

            addEvidence(
                node.give
            );
        }
    }


    /*
     * Resolve current text.
     */

    const currentText =
        resolveText(
            node.text
        );


    /*
     * Scene
     */

    const image =
        $("#sceneImg");


    const stage =
        $("#stage");


    const nextImage =
        scenePath(
            scenes[node.scene]
        );


    if (
        image &&
        stage
    ) {

        const oldScene =
            image.dataset.scene;


        if (
            oldScene !==
            node.scene
        ) {

            stage.classList.add(
                "scene-changing"
            );


            setTimeout(
                () => {

                    if (
                        token !==
                        renderToken
                    ) {

                        return;
                    }


                    image.src =
                        nextImage;


                    image.dataset.scene =
                        node.scene;


                    image.onload =
                        () => {

                            stage.classList.remove(
                                "scene-changing"
                            );
                        };


                    /*
                     * In case the browser has
                     * already cached the image.
                     */

                    setTimeout(
                        () => {

                            stage.classList.remove(
                                "scene-changing"
                            );

                        },
                        220
                    );

                },
                140
            );

        } else {

            image.src =
                nextImage;
        }


        image.alt =
            node.loc || "";
    }


    /*
     * HUD
     */

    if (
        $("#location")
    ) {

        $("#location")
            .textContent =
            node.loc;
    }


    if (
        $("#time")
    ) {

        $("#time")
            .textContent =
            node.time;
    }


    if (
        $("#chapter")
    ) {

        $("#chapter")
            .textContent =
            chapterFor(
                state.node
            );
    }


    updateSpeaker(
        node.speaker,
        node.sub
    );


    /*
     * Choices
     */

    renderChoices(
        node.choices || []
    );


    /*
     * Text

     */

    typeText(
        currentText,
        node
    );

    /*
    * Apply special text animation.
    */

    applyTextEffect(
        node
    );


    /*
     * Final accusation trigger.
     */

    if (
        node.accusation
    ) {

        setTimeout(
            () => {

                openAccusation();

            },
            350
        );
    }


    /*
     * Ending trigger.
     */

    if (
        node.endingRouter
    ) {

        setTimeout(
            () => {

                showEnding(
                    
                    determineEnding()
                );

            },
            700
        );
    }

}


/* =========================================================
   SCENE PATH
   ========================================================= */

function scenePath(
    file
) {

    return `scenes/${file}`;
}


/* =========================================================
   SPEAKER
   ========================================================= */

function updateSpeaker(
    name,
    sub
) {

    const speaker =
        $("#speaker");

    const subElement =
        $("#sub");


    if (
        !speaker
    ) {

        return;
    }


    if (
        subElement
    ) {

        let textNode =
            [...speaker.childNodes]
                .find(
                    node =>
                        node.nodeType ===
                        Node.TEXT_NODE
                );


        if (
            !textNode
        ) {

            textNode =
                document.createTextNode(
                    ""
                );

            speaker.insertBefore(
                textNode,
                speaker.firstChild
            );
        }


        textNode.textContent =
            `${name}\n`;


        subElement.textContent =
            sub || "";

    } else {

        speaker.textContent =
            name;
    }

}


/* =========================================================
   CHAPTER
   ========================================================= */

function chapterFor(id) {

    if (
        [
            "intro",
            "apartment1",
            "letter",
            "clock",
            "phone",
            "call",
            "photo"
        ].includes(id)
    ) {

        return "01 / THE APARTMENT";
    }


    if (
        id.startsWith("lena")
    ) {

        return "02 / THE WITNESSES";
    }


    if (
        id.startsWith("thomas") ||
        id === "water1"
    ) {

        return "03 / THE LIE";
    }


    if (
        id.startsWith("bedroom") ||
        id === "photo_room"
    ) {

        return "04 / THE MISSING FILE";
    }


    if (
        id.startsWith("daniel")
    ) {

        return "05 / THE BROTHER";
    }


    if (
        id.startsWith("archive")
    ) {

        return "06 / THE OLD CASE";
    }


    if (
        id.startsWith("station")
    ) {

        return "07 / THE STATION";
    }


    if (
        id.startsWith("arthur")
    ) {

        return "08 / ARTHUR BELL";
    }


    return "09 / FINAL RECONSTRUCTION";
}


/* =========================================================
   TYPING
   ========================================================= */

function typeText(
    text,
    node = nodes[state.node]
) {

    clearInterval(
        typeTimer
    );

    clearTimeout(
        signalTimer
    );

    typing = true;


    const box =
        $("#text");


    if (
        !box
    ) {

        typing = false;

        return;
    }


    box.textContent =
        "";


    let index = 0;


    /*
     * Optional recording signal-loss effect.
     *
     * The node can define:
     *
     * signalBreak: {
     *     trigger: "I was—",
     *     duration: 650
     * }
     */

    let signalTriggered = false;


    const signal =
        node &&
        node.signalBreak
            ? node.signalBreak
            : null;


    typeTimer =
        setInterval(
            () => {

                /*
                 * Finished typing.
                 */

                if (
                    index >=
                    text.length
                ) {

                    clearInterval(
                        typeTimer
                    );

                    typing = false;

                    return;
                }


                /*
                 * Add the next character.
                 */

                box.textContent +=
                    text[index];


                index++;


                /*
                 * Check for a recording
                 * signal interruption.
                 */

                if (
                    signal &&
                    !signalTriggered &&
                    signal.trigger &&
                    box.textContent.includes(
                        signal.trigger
                    )
                ) {

                    signalTriggered =
                        true;


                    clearInterval(
                        typeTimer
                    );


                    const beforeSignal =
                        box.textContent;

                    box.textContent =
                        beforeSignal +
                        "\n\n" +
                        "             ██████████████";


                    signalTimer =
                        setTimeout(
                            () => {

                                /*
                                 * Restore the text.
                                 */

                                box.textContent =
                                    beforeSignal;


                                /*
                                 * Continue typing
                                 * where we stopped.
                                 */

                                typeTimer =
                                    setInterval(
                                        () => {

                                            if (
                                                index >=
                                                text.length
                                            ) {

                                                clearInterval(
                                                    typeTimer
                                                );

                                                typing =
                                                    false;

                                                return;
                                            }


                                            box.textContent +=
                                                text[index];

                                            index++;

                                        },
                                        12
                                    );

                            },
                            signal.duration ||
                            650
                        );

                }

            },
            12
        );
}

/* =========================================================
   TEXT EFFECTS
   ========================================================= */

function applyTextEffect(
    node
) {

    const box =
        $("#text");


    if (
        !box
    ) {

        return;
    }


    /*
     * Remove any previous animation.
     */

    box.classList.remove(
        "text-shake",
        "text-flicker",
        "text-pulse",
        "text-glitch"
    );


    /*
     * No effect on this node.
     */

    if (
        !node ||
        !node.effect
    ) {

        return;
    }


    /*
     * Force the animation to restart
     * when revisiting a node.
     */

    void box.offsetWidth;


    box.classList.add(
        `text-${node.effect}`
    );

}

function skipType() {

    if (
        !typing
    ) {

        return false;
    }


    clearInterval(
        typeTimer
    );

    clearTimeout(
        signalTimer
    );


    typing = false;


    const node =
        nodes[state.node];


    const text =
        resolveText(
            node.text
        );


    if (
        $("#text")
    ) {

        $("#text")
            .textContent =
            text;
    }


    return true;
}

/* =========================================================
   RETURN / HUB NAVIGATION
   ========================================================= */

/*
 * These nodes are detailed investigation/dialogue nodes.
 *
 * The player can always return to the relevant hub
 * instead of needing to press BACK to reach another
 * investigation option.
 */

const returnHubs = {

    /* -----------------------------------------------------
       MARA'S APARTMENT
       ----------------------------------------------------- */

    letter: [
        "apartment1",
        "Return to the apartment"
    ],

    clock: [
        "apartment1",
        "Return to the apartment"
    ],

    phone: [
        "apartment1",
        "Return to the apartment"
    ],

    call: [
        "apartment1",
        "Return to the apartment"
    ],

    photo: [
        "apartment1",
        "Return to the apartment"
    ],

    photo_room: [
        "bedroom1",
        "Return to Mara's bedroom"
    ],


    /* -----------------------------------------------------
       LENA
       ----------------------------------------------------- */

    lena1: [
        "hall1",
        "Leave Lena / return to the hallway"
    ],

    lena2: [
        "lena1",
        "Ask Lena another question"
    ],

    lena3: [
        "lena1",
        "Ask Lena another question"
    ],

    lena4: [
        "lena1",
        "Ask Lena another question"
    ],

    lena5: [
        "lena1",
        "Ask Lena another question"
    ],


    /* -----------------------------------------------------
       THOMAS
       ----------------------------------------------------- */

    thomas1: [
        "water1",
        "Ask Thomas another question"
    ],

    thomas2: [
        "water1",
        "Ask Thomas another question"
    ],

    thomas3: [
        "water1",
        "Ask Thomas another question"
    ],


    /* -----------------------------------------------------
       BEDROOM
       ----------------------------------------------------- */

    bedroom1: [
        "apartment1",
        "Return to the apartment"
    ],


    /* -----------------------------------------------------
       DANIEL
       ----------------------------------------------------- */

    daniel1: [
        "apartment1",
        "Leave Daniel / return to the case"
    ],

    daniel2: [
        "daniel1",
        "Ask Daniel another question"
    ],

    daniel3: [
        "daniel1",
        "Ask Daniel another question"
    ],

    daniel5: [
        "daniel1",
        "Ask Daniel another question"
    ],

    daniel6: [
        "daniel1",
        "Ask Daniel another question"
    ],

    daniel7: [
        "daniel1",
        "Ask Daniel another question"
    ],


    /* -----------------------------------------------------
       POLICE ARCHIVE
       ----------------------------------------------------- */

    archive1: [
        "bedroom1",
        "Return to Mara's bedroom"
    ],


    /* -----------------------------------------------------
       BELLWEATHER STATION
       ----------------------------------------------------- */

    station1: [
        "archive1",
        "Return to the police archive"
    ],

    station2: [
        "station1",
        "Return to the station"
    ],

    archive_email: [
        "station1",
        "Return to the station"
    ],


    /* -----------------------------------------------------
       ARTHUR
       ----------------------------------------------------- */

    arthur1: [
        "archive1",
        "Return to the case"
    ],

    arthur2: [
        "arthur1",
        "Ask Arthur another question"
    ],

    arthur3: [
        "arthur1",
        "Ask Arthur another question"
    ],

    arthur4: [
        "arthur1",
        "Ask Arthur another question"
    ]

};

/* =========================================================
   CHOICE RENDERING
   ========================================================= */

function renderChoices(choices) {

    const container =
        $("#choices");

    if (!container) {
        return;
    }

    container.innerHTML = "";


    /*
     * Copy the original choices so we don't mutate
     * the story node itself.
     */

    const displayChoices = [
        ...(choices || [])
    ];


    /*
     * Automatically add a hub/return option.
     *
     * This is only added if the node has one
     * defined in returnHubs.
     */

    const returnOption =
        returnHubs[state.node];


    if (returnOption) {

        const alreadyExists =
            displayChoices.some(
                choice =>
                    choice[1] ===
                    returnOption[0]
            );


        if (!alreadyExists) {

            displayChoices.push([
                returnOption[1],
                returnOption[0]
            ]);

        }
    }


    /*
     * Render everything.
     */

    displayChoices.forEach(
        (choice, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "choice";


            button.textContent =
                choice[0];


            button.addEventListener(
                "click",
                () => {

                    go(
                        choice[1]
                    );

                }
            );


            if (
                index === 0
            ) {

                button.classList.add(
                    "selected"
                );
            }


            container.appendChild(
                button
            );

        }
    );


    selected = 0;
}


/* =========================================================
   EVIDENCE BOARD
   ========================================================= */

function openEvidence() {

    const list =
        $("#evidenceList");


    const connections =
        $("#evidenceConnections");


    if (
        !list ||
        !connections
    ) {

        return;
    }


    list.innerHTML =
        "";


    connections.innerHTML =
        "";


    /*
     * Evidence cards
     */

    if (
        !state.evidence.length
    ) {

        list.innerHTML = `
            <div class="card">
                <b>NO EVIDENCE</b>
                <span>
                    You have not logged any evidence yet.
                </span>
            </div>
        `;

    } else {

        const activeConnections =
            getConnections();


        state.evidence.forEach(
            key => {

                const item =
                    evidence[key];


                if (
                    !item
                ) {

                    return;
                }


                const connected =
                    activeConnections
                        .some(
                            connection =>
                                connection.text
                                    .toLowerCase()
                                    .includes(
                                        item[0]
                                            .split(" ")
                                            [0]
                                            .toLowerCase()
                                    )
                        );


                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "card";


                const title =
                    document.createElement(
                        "b"
                    );


                title.textContent =
                    item[0];


                const description =
                    document.createElement(
                        "span"
                    );


                description.textContent =
                    item[1];


                const status =
                    document.createElement(
                        "div"
                    );


                status.className =
                    "card-status";


                if (
                    connected
                ) {

                    status.classList.add(
                        "connected"
                    );

                    status.textContent =
                        "CONNECTED TO CASE";

                } else {

                    status.textContent =
                        "UNCONNECTED";
                }


                card.appendChild(
                    title
                );


                card.appendChild(
                    description
                );


                card.appendChild(
                    status
                );


                list.appendChild(
                    card
                );

            }
        );
    }


    /*
     * Connections
     */

    const activeConnections =
        getConnections();


    if (
        !activeConnections.length
    ) {

        connections.innerHTML = `
            <div class="connection">
                No connections established yet.
            </div>
        `;

    } else {

        activeConnections.forEach(
            connection => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "connection active";


                const title =
                    document.createElement(
                        "span"
                    );


                title.className =
                    "connection-title";


                title.textContent =
                    connection.title;


                const text =
                    document.createElement(
                        "span"
                    );


                text.className =
                    "connection-text";


                text.textContent =
                    connection.text;


                element.appendChild(
                    title
                );


                element.appendChild(
                    text
                );


                /*
                * Connections stay hidden until
                * the player clicks them.
                */

                const isRevealed =
                    state.revealedConnections
                        .includes(
                            connection.title
                        );


                if (
                    !isRevealed
                ) {

                    element.classList.add(
                        "connection-hidden"
                    );

                    element.setAttribute(
                        "role",
                        "button"
                    );

                    element.setAttribute(
                        "tabindex",
                        "0"
                    );


                    const reveal =
                        () => {

                            element.classList.remove(
                                "connection-hidden"
                            );


                            state.revealedConnections
                                .push(
                                    connection.title
                                );


                            save();

                        };


                    element.addEventListener(
                        "click",
                        reveal
                    );


                    element.addEventListener(
                        "keydown",
                        event => {

                            if (
                                event.key === "Enter" ||
                                event.key === " "
                            ) {

                                event.preventDefault();

                                reveal();

                            }

                        }
                    );

                }


                connections.appendChild(
                    element
                );

            }
        );
    }


    $("#evidenceOverlay")
        ?.classList.remove(
            "hidden"
        );
}


/* =========================================================
   DIALOGUE LOG
   ========================================================= */

function openDialogue() {

    renderDialogueLog();


    $("#dialogueOverlay")
        ?.classList.remove(
            "hidden"
        );
}


function renderDialogueLog() {

    const people =
        $("#dialoguePeople");


    const entries =
        $("#dialogueEntries");


    if (
        !people ||
        !entries
    ) {

        return;
    }


    people.innerHTML =
        "";


    entries.innerHTML =
        "";


    const speakers =
        Object.keys(
            state.dialogueLog
        );


    if (
        !speakers.length
    ) {

        entries.innerHTML = `
            <div class="dialogue-empty">
                NO CONVERSATIONS RECORDED.
            </div>
        `;

        return;
    }


    const preferredOrder = [

        "DISPATCH",

        "MARA",

        "LENA",

        "THOMAS",

        "DANIEL",

        "ARTHUR",

        "VALE"

    ];


    speakers.sort(
        (a,b) => {

            const ai =
                preferredOrder.indexOf(
                    a
                );


            const bi =
                preferredOrder.indexOf(
                    b
                );


            if (
                ai === -1 &&
                bi === -1
            ) {

                return a.localeCompare(
                    b
                );
            }


            if (
                ai === -1
            ) {

                return 1;
            }


            if (
                bi === -1
            ) {

                return -1;
            }


            return ai - bi;
        }
    );


    if (
        !selectedDialoguePerson ||
        !state.dialogueLog[
            selectedDialoguePerson
        ]
    ) {

        selectedDialoguePerson =
            speakers[0];
    }


    speakers.forEach(
        person => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "dialogue-person";


            if (
                person ===
                selectedDialoguePerson
            ) {

                button.classList.add(
                    "active"
                );
            }


            const count =
                state.dialogueLog[
                    person
                ].length;


            button.textContent =
                `${person} [${count}]`;


            button.addEventListener(
                "click",
                () => {

                    selectedDialoguePerson =
                        person;

                    renderDialogueLog();

                }
            );


            people.appendChild(
                button
            );

        }
    );


    const personEntries =
        state.dialogueLog[
            selectedDialoguePerson
        ] || [];


    personEntries.forEach(
        entry => {

            const block =
                document.createElement(
                    "article"
                );


            block.className =
                "dialogue-entry";


            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "dialogue-entry-meta";


            meta.textContent =
                `${entry.sub || "CONVERSATION"} · ${entry.time}`;


            const location =
                document.createElement(
                    "div"
                );


            location.className =
                "dialogue-entry-location";


            location.textContent =
                entry.location;


            const text =
                document.createElement(
                    "div"
                );


            text.className =
                "dialogue-entry-text";


            text.textContent =
                entry.text;


            block.appendChild(
                meta
            );


            block.appendChild(
                location
            );


            block.appendChild(
                text
            );


            entries.appendChild(
                block
            );

        }
    );

}


/* =========================================================
   ACCUSATION SCREEN
   ========================================================= */

function openAccusation() {

    const container =
        $("#accusationChoices");


    if (
        !container
    ) {

        return;
    }


    container.innerHTML =
        "";


    const suspects = [

        [
            "DANIEL",
            "daniel"
        ],

        [
            "LENA",
            "lena"
        ],

        [
            "THOMAS",
            "thomas"
        ],

        [
            "ARTHUR",
            "arthur"
        ],

        [
            "I DON'T KNOW",
            "unknown"
        ]

    ];


    suspects.forEach(
        ([label,id]) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "accusation-choice";


            button.textContent =
                label;


            button.addEventListener(
                "click",
                () => {

                    state.accusation =
                        id;


                    save();


                    $("#accusationOverlay")
                        ?.classList.add(
                            "hidden"
                        );


                    go(
                        "final_resolution"
                    );

                }
            );


            container.appendChild(
                button
            );

        }
    );


    $("#accusationOverlay")
        ?.classList.remove(
            "hidden"
        );
}


/* =========================================================
   ENDING
   ========================================================= */

function showEnding(
    ending
) {

    const score =
        investigationScore();


    const overlay =
        $("#endOverlay");


    const windowElement =
        document.querySelector(
            ".ending-window"
        );


    const title =
        $("#endTitle");


    const text =
        $("#endText");


    const kicker =
        $("#endKicker");


    /*
     * Clear previous ending style.
     */

    if (
        windowElement
    ) {

        windowElement.classList.remove(
            "ending-report",
            "ending-last",
            "ending-missing"
        );
    }


    if (
        ending ===
        "report"
    ) {

        windowElement?.classList.add(
            "ending-report"
        );


        kicker.textContent =
            "CASE DISPOSITION";


        title.textContent =
            "THE REPORT";


        text.textContent =
            getReportEndingText();


    } else if (
        ending ===
        "last_statement"
    ) {

        windowElement?.classList.add(
            "ending-last"
        );


        kicker.textContent =
            "MARA'S FINAL WARNING";


        title.textContent =
            "THE LAST STATEMENT";


        text.textContent =
            getLastStatementText();
        fadeMusic(0.03, 1500);


    } else {

        windowElement?.classList.add(
            "ending-missing"
        );


        kicker.textContent =
            "CASE 017 — CLASSIFIED";


        title.textContent =
            "THE MISSING PIECE";


        text.textContent =
            getMissingPieceText();

        if (
            ending === "missing_piece"
        ) {

            text.classList.remove(
                "text-shake",
                "text-flicker",
                "text-pulse",
                "text-glitch"
            );

            void text.offsetWidth;

            text.classList.add(
                "text-glitch"
            );
        }

    }


    $("#endingScore").textContent =
        `INVESTIGATION STRENGTH: ${score}/11`;


    overlay?.classList.remove(
        "hidden"
    );
}


/* =========================================================
   ENDING TEXT
   ========================================================= */

function getReportEndingText() {

    if (
        state.accusation ===
        "daniel"
    ) {

        return (
            "You accuse Daniel Venn.\n\n" +

            "Daniel admits that he confronted Mara and altered the apartment afterward. " +

            "The available evidence is enough to hold him while the investigation continues.\n\n" +

            "The report establishes the surface case:\n\n" +

            "Mara did not simply take her own life.\n\n" +

            "But the older case remains unresolved.\n\n" +

            "Clara Venn is still a file with missing pages.\n\n" +

            "And somewhere inside those missing pages is the reason Mara was afraid."
        );
    }


    if (
        state.accusation ===
        "unknown"
    ) {

        return (
            "You cannot make a confident accusation.\n\n" +

            "Daniel is detained after admitting that he altered the scene, " +

            "but you cannot yet establish the complete chain of events.\n\n" +

            "The case remains open."
        );
    }


    return (
        `You accuse ${state.accusation.toUpperCase()}.\n\n` +

        "The evidence does not fully support the accusation.\n\n" +

        "Daniel's admission that he altered the scene keeps him at the center of the investigation, " +

        "but too many pieces are missing for a complete reconstruction.\n\n" +

        "The report is filed.\n\n" +

        "The deeper mystery remains buried."
    );

}


function getLastStatementText() {

    const accusation =
        state.accusation
            ? state.accusation.toUpperCase()
            : "UNKNOWN";


    if (
        state.accusation ===
        "daniel"
    ) {

        return (
            "Your reconstruction places Daniel at the center of Mara's final confrontation.\n\n" +

            "His statement, the timeline, and the altered apartment form a coherent surface case.\n\n" +

            "But one detail refuses to fit.\n\n" +

            "Mara wasn't only investigating her mother's death.\n\n" +

            "She was investigating Detective Vale.\n\n" +

            "A recording plays:\n\n" +

            "“If Vale is the one reading this, then I was right to be afraid.”\n\n" +

            "The recording stops before she explains why.\n\n" +

            "The murder has an answer.\n\n" +

            "The question of Vale does not."
        );
    }


    return (
        `You accused ${accusation}.\n\n` +

        "The accusation does not fully survive the evidence.\n\n" +

        "But your investigation uncovered something more important.\n\n" +

        "Mara was not only investigating her mother's death.\n\n" +

        "She was investigating Detective Vale.\n\n" +

        "A recording plays:\n\n" +

        "“If Vale is the one reading this, then I was right to be afraid.”\n\n" +

        "The recording ends before she explains why.\n\n" +

        "Whatever happened to Mara, the investigation has turned back toward you."
    );

}


function getMissingPieceText() {

    return (
        "You found almost everything Mara left behind.\n\n" +

        "The missing pages from Clara's case are finally located inside the old Bellweather archive.\n\n" +

        "They contain a list of officers involved in suppressing evidence surrounding Clara's death.\n\n" +

        "One name appears beside the original evidence log:\n\n" +

        "ELIAS VALE.\n\n" +

        "The page is dated twelve years ago.\n\n" +

        "Mara wasn't merely investigating the police.\n\n" +

        "She had discovered that Vale had been connected to Clara's case from the beginning.\n\n" +

        "Then another document falls from the file.\n\n" +

        "A photograph of Mara and Vale together — taken three days before Mara's death.\n\n" +

        "On the back, Mara wrote:\n\n" +

        "“He still doesn't remember me.”\n\n" +

        "You look back at the case.\n\n" +

        "Daniel killed Mara.\n\n" +

        "But Mara's investigation began twelve years earlier.\n\n" +

        "And Vale was already there.\n\n" +

        "THE CASE IS NOT OVER."
    );

}


/* =========================================================
   STORY
   ========================================================= */

const nodes = {


    /* =====================================================
       OPENING
       ===================================================== */

    intro: {

        scene: "apartment",

        loc:
            "17 BELLWEATHER STREET",

        time:
            "23:47",

        speaker:
            "DISPATCH",

        sub:
            "POLICE RADIO",

        text:
            "“Detective Vale? We have a deceased female. Possible suicide.”\n\n" +

            "“Name?”\n\n" +

            "“Mara Venn.”\n\n" +

            "You know the name.",

        choices: [

            [
                "Enter the apartment",
                "apartment1"
            ]

        ]

    },


    /* =====================================================
       MARA'S APARTMENT
       ===================================================== */

    apartment1: {

        scene: "apartment",

        loc:
            "MARA VENN — LIVING ROOM",

        time:
            "23:51",

        speaker:
            "VALE",

        sub:
            "FIELD NOTE",

        text:
            "Rain against the glass.\n\n" +

            "An overturned glass. A half-written letter. A gun beneath the desk.\n\n" +

            "The room looks arranged.\n\n" +

            "Almost too arranged.",

        choices: [

            [
                "Read the letter",
                "letter"
            ],

            [
                "Check the clock",
                "clock"
            ],

            [
                "Check Mara's phone",
                "phone"
            ]

        ]

    },


    letter: {

        scene: "apartment",

        loc:
            "DESK",

        time:
            "23:54",

        speaker:
            "VALE",

        sub:
            "EVIDENCE",

        text:
            "“I am sorry.\n\n" +

            "I know what I have done.\n\n" +

            "I know what I saw.\n\n" +

            "I can't live with—”\n\n" +

            "The sentence stops.",

        give:
            "letter",

        choices: [

            [
                "Look at the clock",
                "clock"
            ],

            [
                "Search the room",
                "photo"
            ],

            [
                "Leave the apartment",
                "hall1"
            ]

        ]

    },


    clock: {

        scene: "apartment",

        loc:
            "LIVING ROOM",

        time:
            "23:56",

        speaker:
            "VALE",

        sub:
            "FIELD NOTE",

        text:
            "The wall clock stopped at 22:18.\n\n" +

            "There is no reason for it to have stopped.\n\n" +

            "Not yet.",

        give:
            "clock",

        choices: [

            [
                "Check the phone",
                "phone"
            ],

            [
                "Look at the letter",
                "letter"
            ],

            [
                "Go into the hall",
                "hall1"
            ]

        ]

    },


    phone: {

        scene: "apartment",

        loc:
            "MARA'S PHONE",

        time:
            "23:58",

        speaker:
            "VALE",

        sub:
            "CALL LOG",

        text:
            "22:41 — outgoing message:\n\n" +

            "“I know who you are.”\n\n" +

            "22:43 — call to police.\n\n" +

            "The call lasted 47 seconds.",

        give:
            "phone",

        choices: [

            [
                "Play the last call",
                "call"
            ],

            [
                "Search the bedroom",
                "bedroom1"
            ],

            [
                "Go into the hall",
                "hall1"
            ]

        ]

    },


    call: {

        scene: "apartment",

        loc:
            "LAST CALL",

        time:
            "00:00",

        speaker:
            "MARA",

        sub:
            "RECORDED CALL",

        text:
            "“If they tell you I killed myself, don't believe them.”\n\n" +

            "Click.\n\n" +

            "Then silence.",

        choices: [

            [
                "Find out who she feared",
                "hall1"
            ],

            [
                "Search the bedroom",
                "bedroom1"
            ]

        ]

    },


    photo: {

        scene: "apartment",

        loc:
            "BOOKSHELF",

        time:
            "00:02",

        speaker:
            "VALE",

        sub:
            "PHOTOGRAPH",

        text:
            "Mara. Daniel. Thomas.\n\n" +

            "And Clara Venn.\n\n" +

            "The fourth face has been scratched away.\n\n" +

            "The back reads:\n\n" +

            "CLARA — SUMMER 2014.",

        give:
            "photo",

        choices: [

            [
                "Go to the hallway",
                "hall1"
            ],

            [
                "Search the bedroom",
                "bedroom1"
            ]

        ]

    },


    /* =====================================================
       LENA
       ===================================================== */

    hall1: {

        scene: "hall",

        loc:
            "APARTMENT HALLWAY",

        time:
            "00:08",

        speaker:
            "VALE",

        sub:
            "FIELD NOTE",

        text:
            "Someone across the hall watches through a chain lock.\n\n" +

            "Lena Orin.\n\n" +

            "Neighbor.\n\n" +

            "Witness.",

        choices: [

            [
                "Question Lena",
                "lena1"
            ],

            [
                "Visit the waterfront",
                "water1"
            ]

        ]

    },


    lena1: {

        scene: "hall",

        loc:
            "LENA ORIN — DOORWAY",

        time:
            "00:12",

        speaker:
            "LENA",

        sub:
            "NEIGHBOR",

        text:
            "“I heard them arguing around ten-thirty.”\n\n" +

            "“A man's voice.”\n\n" +

            "“Mara shouted: ‘You promised me.’”",

        choices: [

            [
                "Ask what the man said",
                "lena2"
            ],

            [
                "Ask what she saw",
                "lena3"
            ],

            [
                "Show her the clock",
                "lena4"
            ]

        ]

    },


    lena2: {

        scene: "hall",

        loc:
            "LENA ORIN — DOORWAY",

        time:
            "00:13",

        speaker:
            "LENA",

        sub:
            "NEIGHBOR",

        text:
            "“I don't remember.”\n\n" +

            "She answers too quickly.",

        onEnter() {

            addFlag(
                "lenaLie"
            );

        },

        choices: [

            [
                "Push harder",
                "lena4"
            ],

            [
                "Leave her alone",
                "water1"
            ]

        ]

    },


    lena3: {

        scene: "hall",

        loc:
            "LENA ORIN — DOORWAY",

        time:
            "00:13",

        speaker:
            "LENA",

        sub:
            "NEIGHBOR",

        text:
            "“Nothing. I stayed inside.”\n\n" +

            "Her hand tightens around the chain.",

        choices: [

            [
                "Push harder",
                "lena4"
            ],

            [
                "Leave",
                "water1"
            ]

        ]

    },


    lena4: {

        scene: "hall",

        loc:
            "LENA ORIN — DOORWAY",

        time:
            "00:15",

        speaker:
            "VALE",

        sub:
            "INTERVIEW",

        text:
            "You mention the recording.\n\n" +

            "Lena goes silent.\n\n" +

            "“Then you already know I was there.”",

        onEnter() {

            addEvidence(
                "audio"
            );

            addEvidence(
                "fingerprint"
            );

            addFlag(
                "lenaPresent"
            );

            addTrust(
                "lena",
                1
            );

        },

        choices: [

            [
                "Ask why she lied",
                "lena5"
            ],

            [
                "Ask about Daniel",
                "daniel1"
            ],

            [
                "Leave",
                "water1"
            ]

        ]

    },


    lena5: {

        scene: "hall",

        loc:
            "LENA ORIN — DOORWAY",

        time:
            "00:17",

        speaker:
            "LENA",

        sub:
            "INTERVIEW",

        text:
            "“I went into the apartment.”\n\n" +

            "“I went there to warn her.”\n\n" +

            "“Not to kill her.”\n\n" +

            "Her eyes move toward Mara's door.",

        onEnter() {

            addFlag(
                "lenaWarning"
            );

            addEvidence(
                "fingerprint"
            );

        },

        choices: [

            [
                "Warn her about whom?",
                "thomas3"
            ],

            [
                "Ask about Daniel",
                "daniel1"
            ],

            [
                "Leave",
                "water1"
            ]

        ]

    },


    /* =====================================================
       THOMAS
       ===================================================== */

    water1: {

        scene: "water",

        loc:
            "BELLWEATHER WATERFRONT",

        time:
            "00:31",

        speaker:
            "VALE",

        sub:
            "CASE NOTE",

        text:
            "Thomas Reed waits beneath a lamp.\n\n" +

            "He says he left Mara's building at 21:50.\n\n" +

            "The time feels rehearsed.",

        choices: [

            [
                "Confront him with the timestamp",
                "thomas1"
            ],

            [
                "Ask why he visited",
                "thomas2"
            ]

        ]

    },


    thomas1: {

        scene: "water",

        loc:
            "WATERFRONT",

        time:
            "00:34",

        speaker:
            "THOMAS",

        sub:
            "FORMER PARTNER",

        text:
            "You tell him the building camera says 22:26.\n\n" +

            "His expression changes.\n\n" +

            "“Fine. We argued. I stayed longer than I said.”\n\n" +

            "“Did you kill her?”\n\n" +

            "“No.”",

        onEnter() {

            addEvidence(
                "camera"
            );

            addTrust(
                "thomas",
                1
            );

            addFlag(
                "thomasAdmittedVisit"
            );

        },

        choices: [

            [
                "Ask who Mara feared",
                "thomas3"
            ],

            [
                "Ask about Daniel",
                "daniel1"
            ],

            [
                "Ask about Mara's mother",
                "bedroom1"
            ]

        ]

    },


    thomas2: {

        scene: "water",

        loc:
            "WATERFRONT",

        time:
            "00:34",

        speaker:
            "THOMAS",

        sub:
            "FORMER PARTNER",

        text:
            "“She was investigating her mother's death.”\n\n" +

            "“She thought someone had buried the truth.”",

        onEnter() {

            addEvidence(
                "records"
            );

            addFlag(
                "thomasKnowsCase"
            );

        },

        choices: [

            [
                "Ask who",
                "thomas3"
            ],

            [
                "Go to Daniel's house",
                "daniel1"
            ],

            [
                "Search Mara's bedroom",
                "bedroom1"
            ]

        ]

    },


    thomas3: {

        scene: "water",

        loc:
            "WATERFRONT",

        time:
            "00:36",

        speaker:
            "THOMAS",

        sub:
            "FORMER PARTNER",

        text:
            "“Mara wasn't afraid of me.”\n\n" +

            "A pause.\n\n" +

            "“She was afraid of someone she trusted.”",

        onEnter() {

            addFlag(
                "trustedPerson"
            );

        },

        choices: [

            [
                "Visit Daniel",
                "daniel1"
            ],

            [
                "Search Mara's bedroom",
                "bedroom1"
            ],

            [
                "Ask Lena what she knows",
                "lena5"
            ]

        ]

    },


    /* =====================================================
       BEDROOM
       ===================================================== */

    bedroom1: {

        scene: "bedroom",

        loc:
            "MARA'S BEDROOM",

        time:
            "00:48",

        speaker:
            "VALE",

        sub:
            "SEARCH",

        text:
            "Photographs. Old notes. A drawer locked with a cheap key.\n\n" +

            "Inside: copies of a twelve-year-old police case.",

        onEnter() {

            addEvidence(
                "records"
            );

        },

        choices: [

            [
                "Read the case file",
                "archive1"
            ],

            [
                "Study the photographs",
                "photo_room"
            ],

            [
                "Find the missing pages",
                "station1"
            ]

        ]

    },


    photo_room: {

        scene: "bedroom",

        loc:
            "MARA'S BEDROOM",

        time:
            "00:51",

        speaker:
            "VALE",

        sub:
            "CASE NOTE",

        text:
            "Pinned beside Mara's desk is a photograph of Clara Venn.\n\n" +

            "Written beneath it:\n\n" +

            "“NOT SUICIDE.”\n\n" +

            "The handwriting is Mara's.",

        onEnter() {

            addEvidence(
                "photo"
            );

            addFlag(
                "maraInvestigatedClara"
            );

        },

        choices: [

            [
                "Read the case file",
                "archive1"
            ],

            [
                "Go to the old station",
                "station1"
            ]

        ]

    },


    /* =====================================================
       DANIEL
       ===================================================== */

    daniel1: {

        scene: "daniel",

        loc:
            "DANIEL VENN'S HOUSE",

        time:
            "01:04",

        speaker:
            "DANIEL",

        sub:
            "BROTHER",

        text:
            "“I haven't spoken to Mara in six months.”\n\n" +

            "He keeps his hands flat on the table.",

        choices: [

            [
                "Ask about his alibi",
                "daniel2"
            ],

            [
                "Show him the photograph",
                "daniel3"
            ],

            [
                "Ask about Clara",
                "daniel4"
            ]

        ]

    },


    daniel2: {

        scene: "daniel",

        loc:
            "DANIEL VENN'S HOUSE",

        time:
            "01:07",

        speaker:
            "DANIEL",

        sub:
            "BROTHER",

        text:
            "“I was home all night.”\n\n" +

            "“My wife can confirm it.”\n\n" +

            "His answer is immediate.",

        onEnter() {

            addFlag(
                "danielLie"
            );

        },

        choices: [

            [
                "Press him about Mara",
                "daniel5"
            ],

            [
                "Leave",
                "archive1"
            ]

        ]

    },


    daniel3: {

        scene: "daniel",

        loc:
            "DANIEL VENN'S HOUSE",

        time:
            "01:09",

        speaker:
            "DANIEL",

        sub:
            "BROTHER",

        text:
            "He stares at the photograph.\n\n" +

            "“She shouldn't have kept digging.”\n\n" +

            "For the first time, he sounds afraid.",

        onEnter() {

            addTrust(
                "daniel",
                1
            );

        },

        choices: [

            [
                "Ask about Clara",
                "daniel4"
            ],

            [
                "Ask what happened tonight",
                "daniel5"
            ],

            [
                "Ask why Mara was afraid",
                "daniel6"
            ]

        ]

    },


    daniel4: {

        scene: "daniel",

        loc:
            "DANIEL VENN'S HOUSE",

        time:
            "01:11",

        speaker:
            "DANIEL",

        sub:
            "BROTHER",

        text:
            "“My mother killed herself.”\n\n" +

            "He looks away.\n\n" +

            "“You shouldn't reopen that case.”",

        onEnter() {

            addFlag(
                "danielProtectingCase"
            );

            addEvidence(
                "records"
            );

        },

        choices: [

            [
                "Read Arthur’s interview",
                "arthur1"
            ],

            [
                "Ask what Mara discovered",
                "daniel5"
            ],

            [
                "Go to the old station",
                "station1"
            ]

        ]

    },


    daniel5: {

        scene: "interview",

        loc:
            "POLICE INTERVIEW ROOM",

        time:
            "01:18",

        speaker:
            "DANIEL",

        sub:
            "FORMAL STATEMENT",

        text:
            () => {

                if (
                    hasEvidence("phone") &&
                    hasEvidence("clock")
                ) {

                    return (
                        "“Mara called police.”\n\n" +

                        "He stops.\n\n" +

                        "“I know what the phone says.”\n\n" +

                        "“So you were there?”\n\n" +

                        "Silence."
                    );
                }


                return (
                    "“Mara was going too far.”\n\n" +

                    "“I wanted her to stop.”\n\n" +

                    "“That's all.”"
                );

            },

        choices: [

            [
                "Confront him with the timeline",
                "daniel6"
            ],

            [
                "Ask who else knew about Clara",
                "archive1"
            ],

            [
                "Leave",
                "station1"
            ]

        ]

    },


    daniel6: {

        scene: "interview",

        effect: "shake",

        loc:
            "POLICE INTERVIEW ROOM",

        time:
            "01:23",

        speaker:
            "DANIEL",

        sub:
            "FORMAL STATEMENT",

        text:
            () => {

                if (
                    hasEvidence("phone") &&
                    hasEvidence("clock")
                ) {

                    return (
                        "Daniel finally looks up.\n\n" +

                        "“I went to see her.”\n\n" +

                        "“At what time?”\n\n" +

                        "“After ten.”\n\n" +

                        "“What happened?”\n\n" +

                        "“We argued.”\n\n" +

                        "His voice drops.\n\n" +

                        "“She called the police.”\n\n" +

                        "“And then?”\n\n" +

                        "“I reached for the gun.”"
                    );
                }


                return (
                    "“Mara wanted people exposed.”\n\n" +

                    "“She didn't understand what that would do.”\n\n" +

                    "Daniel refuses to say more."
                );

            },

        onEnter() {

            if (
                hasEvidence("phone") &&
                hasEvidence("clock")
            ) {

                addEvidence(
                    "danielStatement"
                );

                addFlag(
                    "danielConfronted"
                );
            }

        },

        choices: [

            [
                "Ask what happened after the gun",
                "daniel7"
            ],

            [
                "Ask about Vale",
                "daniel7"
            ],

            [
                "Return to the case",
                "archive1"
            ]

        ]

    },


    daniel7: {

        scene: "interview",

        loc:
            "POLICE INTERVIEW ROOM",

        time:
            "01:26",

        speaker:
            "DANIEL",

        sub:
            "FORMAL STATEMENT",

        text:
            "“It wasn't supposed to happen.”\n\n" +

            "Daniel looks at the table.\n\n" +

            "“She grabbed the gun.”\n\n" +

            "“I pulled it away.”\n\n" +

            "A pause.\n\n" +

            "“Then it fired.”\n\n" +

            "“And you staged the scene?”\n\n" +

            "He says nothing.",

        onEnter() {

            addEvidence(
                "danielStatement"
            );

            addFlag(
                "danielConfessed"
            );

        },

        choices: [

            [
                "Ask about Clara",
                "archive1"
            ],

            [
                "Go to the old station",
                "station1"
            ],

            [
                "Continue investigating",
                "final1"
            ]

        ]

    },


    /* =====================================================
       ARCHIVE
       ===================================================== */

    archive1: {

        scene: "archive",

        loc:
            "POLICE ARCHIVE",

        time:
            "01:32",

        speaker:
            "VALE",

        sub:
            "OLD CASE",

        text:
            "CLARA VENN — 2014.\n\n" +

            "Cause of death: suicide.\n\n" +

            "Evidence missing.\n\n" +

            "Interviews missing.\n\n" +

            "One surviving name appears repeatedly:\n\n" +

            "ARTHUR BELL.",

        onEnter() {

            addEvidence(
                "records"
            );

            addFlag(
                "foundOldCase"
            );

        },

        choices: [

            [
                "Read Arthur's interview",
                "arthur1"
            ],

            [
                "Look for the missing pages",
                "station1"
            ],

            [
                "Compare this with Mara's notes",
                "photo_room"
            ]

        ]

    },


    /* =====================================================
       STATION
       ===================================================== */

    station1: {

        scene: "station",

        loc:
            "OLD BELLWEATHER STATION",

        time:
            "02:01",

        speaker:
            "VALE",

        sub:
            "CASE NOTE",

        text:
            "The abandoned station sits beyond the town lights.\n\n" +

            "Mara's notes mention it twice.\n\n" +

            "A storage box waits beneath platform three.",

        choices: [

            [
                "Open the box",
                "station2"
            ],

            [
                "Go to Arthur's house",
                "arthur1"
            ]

        ]

    },


    station2: {

        scene: "station",

        loc:
            "PLATFORM THREE",

        time:
            "02:04",

        speaker:
            "VALE",

        sub:
            "EVIDENCE",

        text:
            "A recorder.\n\n" +

            "A key.\n\n" +

            "A photograph of Clara.\n\n" +

            "The recorder contains one sentence:\n\n" +

            "“I know who did it.”\n\n" +

            "A second file has been hidden under an innocuous filename.",

        onEnter() {

            addEvidence(
                "email"
            );

            addEvidence(
                "records"
            );

            addFlag(
                "foundStationEvidence"
            );

        },

        choices: [

            [
                "Study Mara's archive",
                "archive_email"
            ],

            [
                "Take the evidence to Arthur",
                "arthur1"
            ]

        ]

    },


    archive_email: {

        scene: "station",

        effect: "glitch",

        signalBreak: {
            trigger: "I was—",
            duration: 700
        },

        loc:
            "MARA'S ARCHIVE",

        time:
            "02:08",

        speaker:
            "MARA",

        sub:
            "RECORDED FILE",

        text:
            "“If Vale is the one reading this, then I was—right to be afraid.”\n\n" +

            "The recording ends.\n\n" +

            "No explanation.\n\n" +

            "Only a second file name:\n\n" +

            "CLARA_2014_FINAL.",

        onEnter() {

            addEvidence(
                "email"
            );

            addFlag(
                "maraInvestigatedVale"
            );

        },

        choices: [

            [
                "Go to Arthur",
                "arthur1"
            ],

            [
                "Return to Mara's apartment",
                "final1"
            ]

        ]

    },


    /* =====================================================
       ARTHUR
       ===================================================== */

    arthur1: {

        scene: "arthur",

        loc:
            "ARTHUR BELL'S HOUSE",

        time:
            "02:26",

        speaker:
            "ARTHUR",

        sub:
            "RETIRED CHIEF",

        text:
            "“Mara finally found it.”\n\n" +

            "He doesn't ask what you mean.\n\n" +

            "“I was a coward.”\n\n" +

            "“That is not the same as being a killer.”",

        choices: [

            [
                "Ask about Clara",
                "arthur2"
            ],

            [
                "Ask where he was tonight",
                "arthur3"
            ]

        ]

    },


    arthur2: {

        scene: "arthur",

        loc:
            "ARTHUR BELL'S HOUSE",

        time:
            "02:29",

        speaker:
            "ARTHUR",

        sub:
            "RETIRED CHIEF",

        text:
            "“Your old case file is incomplete because people wanted it incomplete.”\n\n" +

            "“Who?”\n\n" +

            "“People with something to lose.”",

        onEnter() {

            addEvidence(
                "hospital"
            );

            addFlag(
                "arthurAdmittedCoverup"
            );

        },

        choices: [

            [
                "Ask about Mara",
                "arthur3"
            ],

            [
                "Ask about Detective Vale",
                "arthur4"
            ],

            [
                "Return to the apartment",
                "final1"
            ]

        ]

    },


    arthur3: {

        scene: "arthur",

        loc:
            "ARTHUR BELL'S HOUSE",

        time:
            "02:31",

        speaker:
            "ARTHUR",

        sub:
            "TIMELINE",

        text:
            "Arthur says he was admitted to hospital at 22:54.\n\n" +

            "The record confirms it.\n\n" +

            "Whatever happened in Mara's apartment, Arthur couldn't have been there after that time.",

        onEnter() {

            addEvidence(
                "hospital"
            );

            addFlag(
                "arthurAlibi"
            );

        },

        choices: [

            [
                "Ask about Mara's investigation",
                "arthur4"
            ],

            [
                "Return to Mara's apartment",
                "final1"
            ]

        ]

    },


    arthur4: {

        scene: "arthur",

        loc:
            "ARTHUR BELL'S HOUSE",

        time:
            "02:34",

        speaker:
            "ARTHUR",

        sub:
            "RETIRED CHIEF",

        text:
            "Arthur studies you.\n\n" +

            "“Mara didn't trust the police.”\n\n" +

            "“Why?”\n\n" +

            "“Because she thought one of them had been watching her for years.”",

        onEnter() {

            addFlag(
                "maraWatched"
            );

        },

        choices: [

            [
                "Ask who",
                "final1"
            ],

            [
                "Return to the apartment",
                "final1"
            ]

        ]

    },


    /* =====================================================
       FINAL RECONSTRUCTION
       ===================================================== */

    final1: {

        scene: "final",

        loc:
            "MARA'S APARTMENT — MORNING",

        time:
            "06:12",

        speaker:
            "VALE",

        sub:
            "FINAL RECONSTRUCTION",

        text:
            () => {

                const score =
                    investigationScore();


                return (
                    "The rain has stopped.\n\n" +

                    "Evidence covers Mara's desk.\n\n" +

                    `You have recovered ${state.evidence.length} pieces of evidence.\n\n` +

                    `Investigation strength: ${score}/11.\n\n` +

                    "The question is no longer simply what happened to Mara.\n\n" +

                    "It is what her death was connected to."
                );

            },

        choices: [

            [
                "Reconstruct the timeline",
                "final_timeline"
            ],

            [
                "Review the evidence",
                "final_evidence"
            ],

            [
                "Make final accusation",
                "accusation_start"
            ]

        ]

    },


    final_timeline: {

        scene: "final",

        loc:
            "MARA'S APARTMENT — MORNING",

        time:
            "06:17",

        speaker:
            "VALE",

        sub:
            "RECONSTRUCTION",

        text:
            () => {

                const parts = [];


                if (
                    hasEvidence("clock")
                ) {

                    parts.push(
                        "22:18 — the apartment clock stops."
                    );
                }


                if (
                    hasEvidence("phone")
                ) {

                    parts.push(
                        "22:41 — Mara sends a final message.\n22:43 — she calls police."
                    );
                }


                if (
                    hasEvidence("camera")
                ) {

                    parts.push(
                        "22:26 — Thomas is still in the building."
                    );
                }


                if (
                    hasEvidence("hospital")
                ) {

                    parts.push(
                        "22:54 — Arthur is admitted to hospital."
                    );
                }


                if (
                    hasEvidence("danielStatement")
                ) {

                    parts.push(
                        "After 22:00 — Daniel admits he confronted Mara."
                    );
                }


                if (
                    !parts.length
                ) {

                    return (
                        "The timeline is incomplete.\n\n" +

                        "You don't have enough timestamps yet."
                    );
                }


                return (
                    parts.join("\n\n") +

                    "\n\nThe order matters more than any single statement."
                );

            },

        choices: [

            [
                "Review the evidence",
                "final_evidence"
            ],

            [
                "Make final accusation",
                "accusation_start"
            ]

        ]

    },


    final_evidence: {

        scene: "final",

        loc:
            "MARA'S APARTMENT — MORNING",

        time:
            "06:21",

        speaker:
            "VALE",

        sub:
            "CASE BOARD",

        text:
            () => {

                return (
                    `RECOVERED: ${state.evidence.length}/11\n\n` +

                    "The evidence doesn't answer the case by itself.\n\n" +

                    "Connections do."
                );

            },

        choices: [

            [
                "Reconstruct the timeline",
                "final_timeline"
            ],

            [
                "Make final accusation",
                "accusation_start"
            ]

        ]

    },


    /* =====================================================
       ACCUSATION
       ===================================================== */

    accusation_start: {

        scene: "final",

        loc:
            "FINAL RECONSTRUCTION",

        time:
            "06:24",

        speaker:
            "VALE",

        sub:
            "FINAL DECISION",

        text:
            "The evidence is on the table.\n\n" +

            "The statements are in your notebook.\n\n" +

            "Now decide what you believe happened.",

        accusation:
            true,

        choices: []

    },


    /* =====================================================
       RESOLUTION
       ===================================================== */

    final_resolution: {

        scene: "final",

        effect: "flicker",

        loc:
            "FINAL REPORT",

        time:
            "06:30",

        speaker:
            "VALE",

        sub:
            "CASE DISPOSITION",

        text:
            () => {

                let accusation =
                    state.accusation
                        ? state.accusation.toUpperCase()
                        : "UNKNOWN";


                return (
                    `YOUR ACCUSATION: ${accusation}\n\n` +

                    "The report is ready to be filed."
                );

            },

        endingRouter:
            true,

        choices: []

    }

};


/* =========================================================
   START
   ========================================================= */

$("#startBtn")
    ?.addEventListener(
        "click",
        () => {

            $("#start")
                ?.classList.add(
                    "hidden"
                );


            state.started =
                true;
            
            startMusic();

            render();

            save();

        }
    );


/* =========================================================
   EVIDENCE BUTTON
   ========================================================= */

$("#evidenceBtn")
    ?.addEventListener(
        "click",
        openEvidence
    );


$("#closeEvidence")
    ?.addEventListener(
        "click",
        () => {

            $("#evidenceOverlay")
                ?.classList.add(
                    "hidden"
                );

        }
    );


/* =========================================================
   DIALOGUE BUTTON
   ========================================================= */

$("#dialogueBtn")
    ?.addEventListener(
        "click",
        openDialogue
    );


$("#closeDialogue")
    ?.addEventListener(
        "click",
        () => {

            $("#dialogueOverlay")
                ?.classList.add(
                    "hidden"
                );

        }
    );


/* =========================================================
   BACK
   ========================================================= */

$("#backBtn")
    ?.addEventListener(
        "click",
        () => {

            goBack();

        }
    );


/* =========================================================
   RESTART
   ========================================================= */

$("#resetBtn")
    ?.addEventListener(
        "click",
        () => {

            if (
                confirm(
                    "Restart the investigation?"
                )
            ) {

                localStorage.removeItem(
                    "tls-save"
                );

                location.reload();
            }

        }
    );


$("#endRestart")
    ?.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "tls-save"
            );

            location.reload();

        }
    );


/* =========================================================
   NOTES / NOTEPAD
   ========================================================= */

function openNotes() {

    const overlay =
        $("#notesOverlay");

    const textarea =
        $("#notesText");

    if (!overlay || !textarea) {
        return;
    }

    textarea.value =
        localStorage.getItem("tls-notes") || "";

    overlay.classList.remove("hidden");

    setTimeout(() => {
        textarea.focus();
    }, 50);
}


function closeNotes() {

    $("#notesOverlay")
        ?.classList.add("hidden");

}


$("#notesBtn")
    ?.addEventListener(
        "click",
        openNotes
    );


$("#closeNotes")
    ?.addEventListener(
        "click",
        closeNotes
    );


$("#notesText")
    ?.addEventListener(
        "input",
        event => {

            localStorage.setItem(
                "tls-notes",
                event.target.value
            );

        }
    );


$("#clearNotes")
    ?.addEventListener(
        "click",
        () => {

            if (
                confirm(
                    "Clear all case notes?"
                )
            ) {

                $("#notesText").value = "";

                localStorage.removeItem(
                    "tls-notes"
                );

                $("#notesText").focus();

            }

        }
    );


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        /*
         * ESC always works.
         */

        if (
            event.key === "Escape"
        ) {

            $("#evidenceOverlay")
                ?.classList.add("hidden");

            $("#dialogueOverlay")
                ?.classList.add("hidden");

            $("#accusationOverlay")
                ?.classList.add("hidden");

            $("#notesOverlay")
                ?.classList.add("hidden");

            return;
        }


        /* While the Notes window is open completely disable game keyboard shortcuts/navigation.*/

        if (
            !$("#notesOverlay")
                ?.classList.contains("hidden")
        ) {

            return;
        }


        /*
         * E — evidence
         */

        if (
            key === "e"
        ) {

            openEvidence();

            return;
        }


        /*
         * D — dialogue
         */

        if (
            key === "d"
        ) {

            openDialogue();

            return;
        }


        /*
         * Don't navigate choices while an
         * overlay is open.
         */

        if (
            !$("#evidenceOverlay")
                ?.classList.contains(
                    "hidden"
                ) ||

            !$("#dialogueOverlay")
                ?.classList.contains(
                    "hidden"
                ) ||

            !$("#accusationOverlay")
                ?.classList.contains(
                    "hidden"
                )
        ) {

            return;
        }


        const choices = [
            ...document.querySelectorAll(
                ".choice"
            )
        ];


        if (
            !choices.length
        ) {

            return;
        }


        /*
         * Down
         */

        if (
            event.key ===
            "ArrowDown"
        ) {

            event.preventDefault();


            selected =
                (
                    selected + 1
                ) %
                choices.length;


            choices.forEach(
                (
                    button,
                    index
                ) => {

                    button.classList.toggle(
                        "selected",
                        index ===
                            selected
                    );

                }
            );


            choices[
                selected
            ].focus();

        }


        /*
         * Up
         */

        if (
            event.key ===
            "ArrowUp"
        ) {

            event.preventDefault();


            selected =
                (
                    selected -
                    1 +
                    choices.length
                ) %
                choices.length;


            choices.forEach(
                (
                    button,
                    index
                ) => {

                    button.classList.toggle(
                        "selected",
                        index ===
                            selected
                    );

                }
            );


            choices[
                selected
            ].focus();

        }


        /*
         * Enter
         */

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();


            if (
                skipType()
            ) {

                return;
            }


            if (
                choices[selected]
            ) {

                choices[
                    selected
                ].click();

            }
        }

    }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

load();


if (
    state.started
) {

    $("#start")
        ?.classList.add(
            "hidden"
        );

    render();

}