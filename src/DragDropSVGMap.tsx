import InfoBox from "./components/gametools/InfoBox";

import mappings from './world_mappings.js';
import 'whatwg-fetch';

import * as d3 from 'd3';
import GameTools from "./components/gametools/GameTools";

import 'animate.css';
import { image } from "d3";

const countries_map = require('./world-map.min.svg');

const continents_map = require('./continents.svg');

export enum MapMode {
    Continents,
    Countries
}

export enum MapLevel {
    LearnNames,
    ClickCorrect,
    DragToCorrect,
    PickNameFromList,
    TypeName
}

export class DragDropSVGMap extends InfoBox {
    numClickedItems: number;
    maxItems: number;
    $bottomButton: JQuery;
    orig: SVGElement;
    currentCountry: SVGGraphicsElement;
    targetCountry: d3.Selection<SVGElement, unknown, Element, unknown>;
    targetCountryNode: SVGGElement;
    currentRotation: number;
    currentSize: number;
    countrySource: SVGGElement;
    currentUseSelection: d3.Selection<SVGElement, unknown, Element, unknown>;
    sourceTransform: string;
    transformX: number;
    transformY: number;
    svg_element: SVGSVGElement;
    countryIds: string[];
    tries: number;
    lastTryWasCorrect: boolean;
    individualCountryElements: SVGGElement[];
    svgDefs: SVGDefsElement;
    pickedCountry: SVGElement;
    constructor(protected mode: MapMode, protected level: MapLevel) {
        super("", "", (level == MapLevel.LearnNames) ? "OK" : "Check");
    }
    clearCountryVars() {
        this.currentCountry = null;
        this.currentUseSelection = null;
        this.countrySource = null;
        this.targetCountry = null;
        this.targetCountryNode = null;
        this.pickedCountry = null;
        this.tries = 0;
    }
    async reset() {
        this.numClickedItems = 0;
        this.currentRotation = 0;
        this.currentSize = 1;
        this.clearCountryVars();
        await super.reset();
    }
    getMapForMode(): string {
        if(this.mode == MapMode.Continents)
            return continents_map;
        else if(this.mode == MapMode.Countries)
            return countries_map;
        else
            throw new Error("Unexpected mode");
    }
    clickHandler(el: SVGElement) {
        const name = el.id.replace(/-/g, ' ');
        if(this.level == MapLevel.LearnNames) {
            console.log(name);
            if(el.dataset.addedFill != "true") {
                el.dataset.addedFill = "true";
                const tooltipTemplate = `<div class="tooltip map-tooltip" role="tooltip">
                    <div class="arrow"></div>
                    <div class="tooltip-inner"></div>
                </div>`;
                $(el).tooltip({
                    title: name,
                    container: 'body',
                    template: tooltipTemplate
                });
                d3.select(el).selectAll("path").attr("fill", d3.schemeDark2[this.numClickedItems]);
                this.numClickedItems++;
                if(this.numClickedItems == this.maxItems)
                    this.$footer.show();
            }
            this.$title.text(`That is ${name}`);
            window.responsiveVoice.speak(name, 'US English Female');
        } else if(this.level == MapLevel.ClickCorrect) {
            if(this.targetCountryNode == null)
                return;
            if(el == this.targetCountryNode) {
                d3.select(el).selectAll("path").attr("fill", GameTools.getRandomArrayMember(d3.schemeDark2));
                this.$title.text(`Yes, that's ${name}`);
                setTimeout(() => this.spawnCountry(), 2000);
            } else {
                this.$title.text(`No, that's ${name}`);
            }
        }
        
    }
    async _undisplay() {
        GameTools.showTopBar(true);
        await super._undisplay();
    }
    cloneAndAppendToElement(orig: SVGElement, selection: d3.Selection<SVGElement, any, Element, any>, target: SVGElement): SVGGElement {
        const selArray = selection.clone(true).remove().nodes();
        let group: SVGGElement = selArray[0] as SVGGElement;
        target.appendChild(group);
        return group;
    }
    updateCountryVals(el: SVGElement) {
        if(el == null || el == undefined)
            return;
        const g: SVGUseElement = el as SVGUseElement;
        const box = g.getBBox();
        const centerX = (box.x + box.width / 2);
        const centerY = (box.y + box.height / 2);
        const newTransform = `translate(${-centerX * (this.currentSize -1)} ${-centerY * (this.currentSize -1)}) translate(${this.transformX} ${this.transformY}) scale(${this.currentSize}) rotate(${this.currentRotation} ${centerX} ${centerY})`;
        g.setAttribute("transform", newTransform);
    }
    rotateCountry(g: SVGElement, degrees: number) {
        this.updateCountryVals(g);
    }
    sizeCountry(g: SVGElement, size: number) {
        if(size < 0.25)
            this.currentSize = 0.25;
        this.updateCountryVals(g);
    }
    badRotation(): boolean {
        var rot = this.currentRotation % 360;
        return !(rot == 0 || rot == 1);
    }
    isSingleCountryLevel(): boolean {
        return this.level == MapLevel.TypeName || this.level == MapLevel.PickNameFromList;
    }
    dragFinished(makeVisible = true) {
        if(this.currentCountry == null)
            return;
        const $button = this.$footer.find("button");
        $button.prop("disabled", true);
        var isCorrect = true;
        if(!this.isSingleCountryLevel()) {
            const distance = Math.sqrt(Math.pow(this.transformX, 2) + Math.pow(this.transformY, 2));
            if(this.currentSize != 1) {
                console.log("Bad size");
                isCorrect = false;
            } else if(this.badRotation()) {
                console.log("Bad rotation");
                isCorrect = false;
            } else {
                /* Find distance */
                console.log(distance);
                if(distance >= 5) {
                    console.log("Bad distance");
                    isCorrect = false;
                }
            }
            console.log("Correct: " + isCorrect);
            if(isCorrect) {
                const wasWrong = this.targetCountry.node().classList.contains("show-correct-country");
                this.targetCountry.node().classList.remove("show-correct-country");
                this.$title.text("Nice work! Let's do another one...");
                this.transformX = 0;
                this.transformY = 0;
                this.updateCountryVals(this.currentCountry);
                if(!wasWrong)
                    d3.select(this.countrySource).selectAll("path").attr("fill", GameTools.getRandomArrayMember(d3.schemeDark2));
                else
                    this.countrySource.classList.add("show-correct-country");
                this.currentUseSelection.on(".drag", null);
                this.clearCountryVars();
                setTimeout(() => {
                    this.spawnCountry();
                    $button.prop("disabled", false);
                }, 2000);
            } else {
                function changeTitle(this: DragDropSVGMap) {
                    this.$title.text("Hmm... not quite. Give it another try!");
                    if(distance <= 10)
                        this.$title.text("Nope, but you're close to the right position!");
                    else {
                        if(this.tries >= 2) {
                            if(this.currentSize < 1)
                                this.$title.text("That seems small...");
                            else if(this.currentSize > 1)
                                this.$title.text("That seems a bit big!");
                            else if(this.badRotation())
                                this.$title.text("Are you sure that's what it looks like on a map?");
                        }
                    }
                }
                changeTitle.call(this);
                if(this.tries >= 5) {
                    this.targetCountry.node().classList.add("show-correct-country");
                }
                $button.prop("disabled", false);
            }
        } else {
            let $input: JQuery;
            if(this.level == MapLevel.TypeName) {
                $input = this.$content.find("input");
                const val: string = ($input.val() as string).toLowerCase();
                if(val.length > 3 || val.length < 3) {
                    isCorrect = false;
                } else {
                    const answer = this.targetCountryNode.getAttribute("id").toLowerCase().substr(0, 3);
                    if(val != answer)
                        isCorrect = false;
                }
            } else if(this.level == MapLevel.PickNameFromList) {
                $input = this.$content.find(".dropdown-toggle");
                isCorrect = this.pickedCountry == this.targetCountryNode;
            } else
                throw new Error("Shouldn't get here");
            
            $input.prop("disabled", true);
            if(isCorrect) {
                this.$title.text("Yes! That's right!");
                setTimeout(() => {
                    if(this.level == MapLevel.TypeName)
                        $input.val("");
                    this.spawnCountry();
                    $input.prop("disabled", false);
                }, 2000);
            } else {
                if(makeVisible) {
                    GameTools.animateCSS(this.$dialog.find(".modal-dialog").get(0), "shake");
                    this.$title.text("Hmm.. that doesn't seem right.");
                }
                $button.prop("disabled", false);
                $input.prop("disabled", false);
            }
        }
        
        this.lastTryWasCorrect = isCorrect;
    }
    buttonCallback(e: JQuery.ClickEvent) {
        if(this.level == MapLevel.PickNameFromList) {
            this.pickedCountry = this.svg_element.querySelector("#" + (e.target as HTMLElement).textContent.replace(/ /g, '-'));
            this.dragFinished();
        } if(this.level != MapLevel.LearnNames) {
            this.tries++;
            this.dragFinished();
        } else {
            $(e.target).prop("disabled", true);
            this.displayNext();
        }
    }
    spawnCountry() {
        const setTitle = (opt?: string) => {
            opt = GameTools.pl_undef(opt, "");
            if(this.level == MapLevel.ClickCorrect)
                this.$title.text(`Click on ${opt}`);
            else
                this.$title.text(`${this.level == MapLevel.DragToCorrect ? "Drag" : "Manipulate"} the country into position.`);
        };
        
        if(this.countryIds.length == 0) {
            /* End the whole thing */
            this.clearCountryVars();
            this.displayNext();
            return;
        }
        
        const oldId = GameTools.getRandomArrayMember(this.countryIds);
        this.countryIds.splice(this.countryIds.indexOf(oldId), 1);
        if(this.level == MapLevel.ClickCorrect) {
            this.targetCountryNode = this.svg_element.querySelector(oldId);
            setTitle(oldId.substr(1).replace(/-/g, ' '));
        } else if(!this.isSingleCountryLevel()) {
            setTitle();
            this.targetCountry = d3.select(this.svg_element).select(oldId);
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            this.svg_element.appendChild(defs);
            this.countrySource = this.cloneAndAppendToElement(this.svg_element, this.targetCountry, defs);
            this.countrySource.classList.add("current-country-source");
            this.countrySource.classList.remove("background-country");
            this.sourceTransform = this.countrySource.getAttribute("transform");
            if(this.sourceTransform == null)
                this.sourceTransform = "";
            this.targetCountry.node().setAttribute("data-old-id", this.targetCountry.node().getAttribute("id"));
            this.targetCountry.node().setAttribute("id", '');
            this.currentCountry = document.createElementNS("http://www.w3.org/2000/svg", "use");
            this.svg_element.appendChild(this.currentCountry);
            this.currentUseSelection = d3.select(this.currentCountry);
            this.currentUseSelection
                .attr("href", oldId)
                .attr("x", 0)
                .attr("y", 0);
            this.currentCountry.classList.add("current-country");
            const _self = this;
            this.currentUseSelection.call(d3.drag().subject(() => {
                return { x: this.transformX, y: this.transformY }; 
            }).on("drag", function(d: any) {
                console.log(`x: ${d3.event.x} y: ${d3.event.y}`);
                _self.transformX = d3.event.x;
                _self.transformY = d3.event.y;
                _self.updateCountryVals(_self.currentCountry);
            }).on("start", function() {
                console.log("started");
                _self.svg_element.style.touchAction = "none";
            }).on("end", () => {
                this.svg_element.style.touchAction = '';
                this.dragFinished();
                if(!this.lastTryWasCorrect)
                    setTitle();
            }));
            if(this.level != MapLevel.DragToCorrect) {
                this.currentRotation = GameTools.getRandomInt(-7, 7) * 45;
                this.currentSize = 1 + (GameTools.getRandomInt(-3, 3) * 0.25);
            } else {
                this.currentRotation = 0;
                this.currentSize = 1;
            }
            
            this.transformX = 0;
            this.transformY = 0;
            console.log("Size: " + this.currentSize);
            window.requestAnimationFrame(() => {
                const box = this.currentCountry.getBBox();
                this.transformX = -(box.x);
                this.transformY = -(box.y);
                this.updateCountryVals(this.currentCountry);
                const mapdiv = this.$content.find(".gt-svgmap-map-div").get(0);
                mapdiv.scrollLeft = 0;
                mapdiv.scrollTop = 0;
            });
        } else {
            if(this.level == MapLevel.TypeName)
                this.$title.text("Type the first three letters of this country's name.");
            else if(this.level == MapLevel.PickNameFromList)
                this.$title.text("What country is this?");
            else
                throw new Error("Should not be here");
            //this.svg_element.querySelectorAll("g").forEach(g => g.parentNode.removeChild(g));
            this.targetCountryNode = null;
            for(const country of this.individualCountryElements) {
                if(country.getAttribute("id") == oldId.slice(1)) {
                    this.targetCountryNode = country;
                    break;
                }
            }
            if(this.targetCountryNode == null)
                throw new Error("No reference to country element");
            this.currentCountry.setAttribute("href", oldId);
            const parent = this.svg_element.parentNode;
            const next = this.svg_element.nextSibling;
            parent.removeChild(this.svg_element);
            parent.insertBefore(this.svg_element, next);
            window.requestAnimationFrame(() => {
                this.onSvgRendered();
            });
        }
        
    }
    onSvgRendered() {
        const use = this.currentCountry;
        const box = use.getBBox();
        use.setAttribute("transform", `translate(${-box.x} ${-box.y})`);
        this.svg_element.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    }
    async dialogCreated() {
        await super.dialogCreated();
        const response = await fetch(this.getMapForMode());
        const map_svghtml = await response.text();
        if(!this.isSingleCountryLevel()) {
            GameTools.showTopBar(false);
            const controls_div = $("<div></div>").addClass("gt-svgmap-controls-div");
            for(const [key, val] of Object.entries({
                "fa-undo": () => this.rotateCountry(this.currentCountry, this.currentRotation -= 45),
                "fa-redo": () => this.rotateCountry(this.currentCountry, this.currentRotation += 45),
                "fa-expand": () => this.sizeCountry(this.currentCountry, this.currentSize += 0.25),
                "fa-compress": () => this.sizeCountry(this.currentCountry, this.currentSize -= 0.25),
            })) {
                const button = $("<button></button>").addClass("btn btn-primary").append($("<i></i>").addClass(`fas ${key}`));
                if(val != null && val != undefined)
                    button.click(val);
                controls_div.append(button);
            }
            const map_div = $("<div></div>").addClass("gt-svgmap-map-div");
            this.$content.append($("<div></div>").append(controls_div).append(map_div).addClass("gt-svgmap-flexbox"));
            map_div.append(map_svghtml);
            this.$content.addClass("gt-svgmap");
            this.svg_element = (this.$content.find('svg').get(0) as any);
            this.orig = this.svg_element;
            if(this.mode == MapMode.Continents)
                this.svg_element.classList.add("continents-svg");
            const d3el = d3.select(this.svg_element);
            const backgroundCountries = d3el.selectAll("g");
            
            const _self = this;
            backgroundCountries.each(function(this: SVGGElement) {
                this.classList.add("background-country");
            });
            this.countryIds = [];
            backgroundCountries.each(function(this: SVGGElement) {
                _self.countryIds.push("#" + this.getAttribute("id"));
            });
            if(this.level == MapLevel.LearnNames || this.level == MapLevel.ClickCorrect) {
                if(this.level == MapLevel.LearnNames)
                    this.$title.text("Click the countries to learn their names!");
                this.$footer.hide();
                controls_div.remove();
                backgroundCountries.each(function(this: SVGGElement) {
                    this.style.cursor = 'pointer';
                });
                let itemSelection: d3.Selection<SVGElement, unknown, Element, unknown>;
                if(this.mode == MapMode.Continents) {
                    itemSelection = d3el.selectAll(".background-country");
                } else {
                    itemSelection = d3.select("");
                }
                backgroundCountries.each(function(this: SVGGElement) { this.classList.remove("background-country"); });
                this.maxItems = itemSelection.size();
                this.spawnCountry();
                itemSelection.on("click", function(this: SVGElement) {
                    _self.clickHandler(this);
                });
            } else {
                if(this.level == MapLevel.DragToCorrect)
                    controls_div.remove();
                this.spawnCountry();
                if(this.currentCountry != null)
                    this.currentCountry.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center'});
            }
        } else {
            var parser = new DOMParser();
            var doc = parser.parseFromString(map_svghtml, "image/svg+xml");
            this.svg_element = doc.documentElement as unknown as SVGSVGElement;
            this.countryIds = [];
            this.individualCountryElements = [];
            this.svg_element.setAttribute("viewBox", null);
            this.svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            this.currentCountry = document.createElementNS("http://www.w3.org/2000/svg", "use");
            this.svg_element.classList.add("gt-svgmap-country-svg");
            this.svg_element.appendChild(this.svgDefs);
            this.svg_element.appendChild(this.currentCountry);
            this.svg_element.querySelectorAll("g").forEach((country) => {
                this.countryIds.push("#" + country.getAttribute("id"));
                this.individualCountryElements.push(country);
                console.log("Append to svgDefs");
                this.svgDefs.appendChild(country);
            });
            console.log(this.svg_element.outerHTML);
            console.log(this.svgDefs);
            this.$content.append(this.svg_element);
            if(this.level == MapLevel.TypeName)
                this.$content.append($("<input></input>").attr("type", "text").attr("maxlength", "3").addClass("form-control").on("input", () => this.dragFinished(false)).on("keyup", (e) => {
                    if(e.which == 13)
                        this.dragFinished(true);
                }));
            else {
                this.$footer.hide();
                const dropDown = $("<div></div>").addClass("dropdown");
                const button = $("<button></button>").addClass("btn btn-secondary dropdown-toggle").text("Choose a country").attr("data-toggle", "dropdown");
                dropDown.append(button);
                const menu = $("<div></div>").addClass("dropdown-menu h-auto").css({
                    "overflow-x": "hidden",
                    "max-height": "50vh"
                });
                this.countryIds.forEach((name) => {
                    menu.append($("<a></a>").addClass("dropdown-item").attr("href", "#").text(name.substr(1).replace(/-/g, ' ')).click((e) => this.buttonCallback(e)));
                });
                dropDown.append(menu);
                this.$content.append(dropDown);
                button.dropdown();
            }
            this.spawnCountry();
        }
    }
}
export default DragDropSVGMap;