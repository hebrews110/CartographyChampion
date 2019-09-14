
import "core-js/stable";
import "regenerator-runtime";

import './components/import-jquery';

import 'popper.js';
import 'bootstrap';

import React from 'react';
import ReactDOM from 'react-dom';

import '@fortawesome/fontawesome-free/css/all.css';

import GameTools from './components/gametools/GameTools';
import InfoBox from './components/gametools/InfoBox';
import { initializeArray, startDisplay } from './components/gametools/DisplayedItem';
import DragDropSVGMap, { MapMode, MapLevel } from "./DragDropSVGMap";
import InteractiveSVGFinder from "./components/gametools/InteractiveSVGFinder";

let myArray = [
    new DragDropSVGMap(MapMode.Continents, MapLevel.PickNameFromList)
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