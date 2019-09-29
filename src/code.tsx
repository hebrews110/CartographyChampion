
import 'core-js/stable';
import "regenerator-runtime";

import './components/import-jquery';

import 'popper.js';
import 'bootstrap';

import React from 'react';
import ReactDOM from 'react-dom';

import '@fortawesome/fontawesome-free/css/all.css';

import GameTools from './components/gametools/GameTools';
import { initializeArray, startDisplay, StylisticOptions } from './components/gametools/DisplayedItem';
import DragDropSVGMap, { MapMode, MapLevel, ValidContinents } from "./DragDropSVGMap";
import Invoke from './components/gametools/Invoke';
import Condition from './components/gametools/Condition';
import Label from './components/gametools/Label';
import Loop from './components/gametools/Loop';
import Question, { QuestionType, QuestionOption } from './components/gametools/Question';
import SetBackground from './components/gametools/SetBackground';
import TitleScreen from './components/gametools/TitleScreen';
import InfoBox from './components/gametools/InfoBox';

var level: MapLevel = null;
var mode: MapMode = null;
var continentName: string = null;
function processLink() {
    if(GameTools.directLink.length > 0) {
        const parts = GameTools.directLink.split('-');
        mode = GameTools.pl_undef(MapMode[parts[0] as keyof typeof MapMode], null, true);
        level = GameTools.pl_undef(MapLevel[parts[1] as keyof typeof MapLevel], null, true);
        if(parts[2] != undefined)
            continentName = GameTools.pl_undef(parts[2].replace(/([A-Z])/g, ' $1').trim(), null, true);
    }
}

function extractEnumAsQuestionOption(e: any): QuestionOption[] {
    let arr: QuestionOption[] = [];
    Object.keys(e).filter((enumMember) => parseInt(enumMember, 10) >= 0).sort((a, b) => e[a] - e[b]).forEach((enumMember) => {
        arr.push({ html: GameTools.unCamelCase(e[enumMember] as string) });
    });
    return arr;
}

const questionStyle: StylisticOptions = {
    showCorrectConfirmation: false,
    shouldShuffle: false
};
const questionArray: QuestionOption[] = [
    { html: "Africa" },
    { html: "Asia" },
    { html: "Europe" },
    { html: "South America" }
];
let myArray = [
    new Invoke(() => window.addEventListener("popstate", () => window.location.reload())),
    new SetBackground(require('./components/globe.svg'), "globe-tile"),
    new TitleScreen("This game is best played on a PC and will not work in IE.", false),
    new Invoke(processLink),
    new Condition(Label.label(""), new Loop({ index: "run" }), () => mode == null),
    new Question(QuestionType.MultipleChoice, "Choose a category.", extractEnumAsQuestionOption(MapMode), false, questionStyle),
    new Invoke(() => mode = MapMode[GameTools.reCamelCase(MapMode[GameTools.lastData])]),
    new Question(QuestionType.MultipleChoice, "Choose a level.", extractEnumAsQuestionOption(MapLevel), false, questionStyle),
    new Invoke(() => level = MapLevel[GameTools.reCamelCase(MapLevel[GameTools.lastData])]),
    new Condition(Label.label(""), new Loop({ index: "run" }), () => mode != MapMode.Continents),
    new Question(QuestionType.MultipleChoice, "Choose a continent.", questionArray, false, questionStyle),
    new Invoke(() => {
        continentName = questionArray[GameTools.lastData].html as string;
        console.log(continentName);
    }),

    Label.label("run"),
    new Invoke(() => {
        /* Update the URL to match it */
        if (window.history && window.history.replaceState) {
            const linkName = (continentName != null ? continentName.replace(/ /g, '') : null);
            window.history.pushState({}, document.title, `${location.protocol}//${location.host}${location.pathname}?link=${MapMode[mode]}-${MapLevel[level]}${linkName != null ? "-" : ""}${linkName != null ? linkName: ""}`);
        }
    }),
    
    new DragDropSVGMap(() => mode, () => level, () => (continentName as ValidContinents)),
    new SetBackground(require('./components/fireworks.jpg')),
    new InfoBox("Great work!", "You've finished!", null)
];

$(async function() {
    
    console.log(process.env.NODE_ENV);
    let badge = undefined;
    if(process.env.NODE_ENV == 'production') {
        await GameTools.sleep(3000-((window as any).load_endDate - (window as any).load_startDate));
    } else
        badge = <span>&nbsp;<span className="badge badge-secondary">development version</span></span>;
    await GameTools.monkeyPatch();
    
    ReactDOM.render(<>
        <span className="top-title">{document.title}{badge}</span>
        <div className="top-buttons">
        </div>
    </>, $("#top-bar").get(0));
    
    initializeArray(myArray);
    startDisplay(myArray);
});