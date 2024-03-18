document.addEventListener('DOMContentLoaded', () => {
    const numberOfQuestions = 10;
    let verbsRange;
    const slider = document.getElementById('numVerbsSlider');
    const numVerbsDisplay = document.getElementById('numVerbsValue');

    // Cargar el número de verbos guardado o usar el valor por defecto
    const savedNumVerbs = localStorage.getItem('numVerbs') || 10;
    slider.value = savedNumVerbs;
    numVerbsDisplay.textContent = savedNumVerbs;
    verbsRange = savedNumVerbs;

    // Actualizar el valor mostrado cuando el slider cambia
    slider.oninput = function () {
        numVerbsDisplay.textContent = this.value;
        verbsRange = this.value
        localStorage.setItem('numVerbs', this.value);
    };

    let verbsStatistics = JSON.parse(localStorage.getItem('verbsStatistics')) || {};

    const userNameDisplay = document.getElementById('userNameDisplay');
    const startButton = document.getElementById('startTest');
    const testScreen = document.getElementById('testScreen');
    const reportScreen = document.getElementById('reportScreen');
    const reportsContent = document.getElementById('reportsContent');
    const showReportsButton = document.getElementById('showReports');

    const userName = localStorage.getItem('userName');
    if (userName) {
        document.getElementById('welcomeScreen').classList.add('hidden');
        userNameDisplay.textContent = `Hi, ${userName}`;
        userNameDisplay.classList.remove('hidden');
        startTest();
    } else {
        startButton.addEventListener('click', handleStartButtonClick);
    }

    function handleStartButtonClick() {
        const userNameInput = document.getElementById('userName').value.trim();
        if (userNameInput === '') {
            alert('Please enter your name.');
            return;
        }
        localStorage.setItem('userName', userNameInput);
        userNameDisplay.textContent = `Hi, ${userNameInput}`;
        userNameDisplay.classList.remove('hidden');
        document.getElementById('welcomeScreen').classList.add('hidden');
        startTest();
    }

    function startTest() {
        const selectedVerbs = selectRandomVerbs(numberOfQuestions, verbsRange);
        displayTest(selectedVerbs);
    }

    function selectRandomVerbs(count, range) {
        // Asegúrate de que el arreglo de verbos tenga al menos 10 elementos
        if (range.length < 10) {
            console.error("La lista de verbos no es lo suficientemente larga.");
            return [];
        }

        // Selecciona los últimos 10 verbos
        const lastTenVerbs = range.slice(-10);

        // Mezcla los últimos 10 verbos
        const shuffledLastTenVerbs = lastTenVerbs.sort(() => 0.5 - Math.random());

        // Selecciona los primeros 3 verbos del arreglo mezclado
        const selectedVerbs = shuffledLastTenVerbs.slice(0, count);

        return selectedVerbs;
        /*const limitedVerbs = verbs.slice(0, range);
        const shuffled = limitedVerbs.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);*/
    }

    function displayTest(verbs) {
        testScreen.innerHTML = '';
        testScreen.classList.remove('hidden');
        //reportScreen.classList.add('hidden');
        //showReportsButton.classList.add('hidden');

        const testForm = document.createElement('form');
        testForm.id = 'testForm';
        testForm.classList.add('space-y-4');

        verbs.forEach((verb, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question', 'flex', 'flex-wrap', 'gap-4', 'p-3', 'border', 'rounded', 'mb-4');



            // Crear y añadir un elemento para mostrar el ID del verbo
            const verbIdDisplay = document.createElement('div');
            verbIdDisplay.textContent = `Verb ID: ${verb.id}`;
            verbIdDisplay.classList.add('verb-id', 'font-bold');
            questionDiv.appendChild(verbIdDisplay);

            const inputGroupContainer = document.createElement('div');
            inputGroupContainer.classList.add('input-group', 'flex', 'border', 'p-2', 'rounded');


            const keys = ['infinitive', 'past', 'participle', 'meaning'];
            const keyToShow = keys[Math.floor(Math.random() * keys.length)];

            keys.forEach((key) => {
                const inputGroup = document.createElement('div');
                inputGroup.classList.add('flex', 'flex-col', 'items-start', 'mr-2');
                if (key === keyToShow) {
                    inputGroup.innerHTML = `<label>${key.toUpperCase()}:</label>
                    <input type="text" value="${verb[key]}"  id="${key}_${index}" name="${key}_${index}" autocomplete="off" disabled class="bg-yellow-200 text-yellow-900 border-2 border-yellow-500 p-1 w-full" style="text-transform:uppercase;">`;
                } else {
                    inputGroup.innerHTML = `<label for="${key}_${index}">${key.toUpperCase()}:</label>
                    <input type="text" id="${key}_${index}" name="${key}_${index}" autocomplete="off" class="border-2 border-gray-300 p-1 w-full" oninput="this.value = this.value.toUpperCase()">`;
                }
                inputGroupContainer.appendChild(inputGroup);
            });

            questionDiv.appendChild(inputGroupContainer);
            testForm.appendChild(questionDiv);
        });

        const submitButton = document.createElement('button');
        submitButton.id = "checkResults"
        submitButton.type = 'submit';
        submitButton.textContent = 'Comprobar';
        submitButton.classList.add('bg-blue-500', 'text-white', 'px-4', 'py-2');
        testForm.appendChild(submitButton);

        testForm.addEventListener('submit', (event) => validateAnswers(event, verbs));

        testScreen.appendChild(testForm);
    }

    function validateAnswers(event, verbs) {
        event.preventDefault();
        const formData = new FormData(event.target);
        let score = 0;

        verbs.forEach((verb, index) => {
            let allCorrect = true;
            const questionDiv = document.querySelector(`#testForm .question:nth-child(${index + 1})`);

            ['infinitive', 'past', 'participle', 'meaning'].forEach((key) => {
                const inputField = document.querySelector(`[name="${key}_${index}"]`);
                if (inputField && !inputField.disabled) {
                    const userAnswer = formData.get(`${key}_${index}`)?.toUpperCase();
                    const correctAnswer = verb[key].toUpperCase();

                    if (!verbsStatistics[verb.id]) {
                        verbsStatistics[verb.id] = { hits: 0, misses: 0, details_hits: { infinitive: 0, past: 0, participle: 0, meaning: 0 }, details_misses: { infinitive: 0, past: 0, participle: 0, meaning: 0 } };
                    }
                    //if (userAnswer === correctAnswer) {
                    if (correctAnswer.split('/').map(val => val.trim().toUpperCase()).includes(userAnswer)) {
                        // El usuario respondió correctamente
                        inputField.style.borderColor = 'green';
                        verbsStatistics[verb.id].details_hits[key] += 1;
                    } else {
                        inputField.style.borderColor = 'red';
                        allCorrect = false;
                        verbsStatistics[verb.id].details_misses[key] += 1;
                        // Crear y agregar un nuevo mensaje de error con la respuesta correcta
                        const errorMessage = document.createElement('div');
                        errorMessage.classList.add('error-message');
                        errorMessage.style.color = 'red';
                        errorMessage.textContent = `Correct: ${verb[key]}`;
                        inputField.parentNode.insertBefore(errorMessage, inputField.nextSibling);
                    }
                }
            });

            if (allCorrect) {
                verbsStatistics[verb.id].hits += 1;
                score++;
                questionDiv.style.backgroundColor = 'lightblue';
            } else {
                verbsStatistics[verb.id].misses += 1;
            }
        });

        localStorage.setItem('verbsStatistics', JSON.stringify(verbsStatistics));
        showResults(score, verbs.length);
        document.getElementById('checkResults').style.display = 'none'; // Ocultar el botón de comprobar resultados
    }

    function showResults(score, totalQuestions) {
        const resultsDiv = document.createElement('div');
        resultsDiv.classList.add('results', 'p-4', 'border', 'border-gray-400', 'rounded', 'mb-4');
        resultsDiv.innerHTML = `<h3 class="text-lg font-semibold mb-2">Resultados del Test</h3>
                                <p>Tu puntuación es ${score} de ${totalQuestions}.</p>`;

        console.log("show results");

        // Añadir el div de resultados al final del testScreen, manteniendo el formulario visible
        testScreen.appendChild(resultsDiv);

        // Asegurarse de que el botón de informes sea visible y esté disponible para clic
        document.getElementById('showReports').style.display = 'block'; // O usar 'inline' o 'inline-block', según tu diseño


        addActionButton('Realizar Otro Test', () => window.location.reload());
        addActionButton('Repetir Este Test', () => {
            document.getElementById('testForm').style.display = 'block'; // Mostrar nuevamente el formulario de test
            startTest();
        });
        //showReportsButton.classList.remove('hidden'); // Mostrar el botón de informes
    }

    function addActionButton(text, onClickCallback) {
        const button = document.createElement('button');
        button.textContent = text;
        button.classList.add('action-button', 'bg-green-500', 'text-white', 'px-4', 'py-2', 'mr-2');
        button.addEventListener('click', onClickCallback);
        testScreen.appendChild(button);
    }

    function generateReports() {
        reportsContent.innerHTML = '<h3>Informe de Resultados</h3>';
        const stats = JSON.parse(localStorage.getItem('verbsStatistics')) || {};

        // Convertir stats a un array y ordenarlo según las especificaciones
        const sortedStats = Object.entries(stats).sort((a, b) => {
            const totalMissesA = a[1].misses;
            const totalMissesB = b[1].misses;
            const totalHitsA = a[1].hits;
            const totalHitsB = b[1].hits;
            return totalMissesB - totalMissesA || totalHitsB - totalHitsA;
        });

        sortedStats.forEach(([verbId, stat]) => {
            const verb = verbs.find(v => v.id.toString() === verbId);
            if (verb) {
                const verbReport = document.createElement('div');
                // Se crea un contenedor para todo el contenido del reporte de este verbo
                let verbInfoHTML = `<h4>[<b>${verb.id}</b>] ${verb.infinitive}<sup style="color:red;">${stat.details_misses.infinitive}</sup><sup style="color:green;">${stat.details_hits.infinitive}</sup>, ${verb.past}<sup style="color:red;">${stat.details_misses.past}</sup><sup style="color:green;">${stat.details_hits.past}</sup>, ${verb.participle}<sup style="color:red;">${stat.details_misses.participle}</sup><sup style="color:green;">${stat.details_hits.participle}</sup> - ${verb.meaning}<sup style="color:red;">${stat.details_misses.meaning}</sup><sup style="color:green;">${stat.details_hits.meaning}</sup>`;

                // Agregar puntos para aciertos (verdes)
                for (let i = 0; i < stat.hits; i++) {
                    verbInfoHTML += `<span class="hit-dot" style="height:10px; width:10px; background-color:green; border-radius:50%; display:inline-block; margin-left: 2px;"></span>`;
                }

                // Agregar puntos para fallos (rojos)
                for (let i = 0; i < stat.misses; i++) {
                    verbInfoHTML += `<span class="miss-dot" style="height:10px; width:10px; background-color:red; border-radius:50%; display:inline-block; margin-left: 2px;"></span>`;
                }

                // Se cierra el contenedor <h4>
                verbInfoHTML += `</h4>`;

                // Ahora asignamos todo el HTML generado al verbReport de una sola vez
                verbReport.innerHTML = verbInfoHTML;
                reportScreen.appendChild(verbReport);
            }
        });

        //testScreen.classList.add('hidden');
        reportScreen.classList.remove('hidden');
    }

    document.getElementById('resetStats').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todas las estadísticas? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('verbsStatistics'); // Borrar las estadísticas del almacenamiento local
            alert('Las estadísticas han sido borradas.');
            // Opcionalmente, puedes recargar la página o actualizar la UI para reflejar el borrado de estadísticas
            window.location.reload();
        }
    });


    showReportsButton.addEventListener('click', generateReports);
});
