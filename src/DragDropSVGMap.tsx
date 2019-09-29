import InfoBox from "./components/gametools/InfoBox";
import country from 'country-list-js';
import Flatten from '@flatten-js/core';
import 'whatwg-fetch';

import * as d3 from 'd3';
import GameTools from "./components/gametools/GameTools";

import 'animate.css';
import DisplayedItem, { GameValue } from "./components/gametools/DisplayedItem";

import Hammer from 'hammerjs';

const countries_map = require('./BlankMap-World.svg');

const continents_map = require('./continents.svg');

import sortBy from 'lodash-es/sortBy';
import Panzoom from '../node_modules/@panzoom/panzoom/src/panzoom';

import possessive from './components/possessive';
import pluralize from 'pluralize';

export enum MapMode {
    Continents,
    Countries,
    Capitals
}

export enum MapLevel {
    LearnNames,
    ClickCorrectOption,
    ClickCorrectOptionWithDisappearance,
    DragOptionToCorrectLocation,
    DragOptionWithDisappearance,
    PickNameFromList,
    TypeName,
    TypeNameWithNoOutlines,
    DragAndSizeOption
}
export type ValidContinents = "Africa"|"Europe"|"North America"|"South America"|"Asia"|"Australia";
export class DragDropSVGMap<T extends MapMode = MapMode> extends InfoBox {
    numClickedItems: number;
    maxItems: number;
    $bottomButton: JQuery;
    orig: SVGElement;
    currentCountry: SVGGraphicsElement;
    targetCountry: d3.Selection<SVGElement, unknown, Element, unknown>;
    targetCountryNode: SVGGElement;
    currentRotation: number;
    currentSize: number;
    countrySource: SVGGElement|SVGPathElement;
    currentUseSelection: d3.Selection<SVGElement, unknown, Element, unknown>;
    sourceTransform: string;
    transformX: number;
    transformY: number;
    svg_element: SVGSVGElement;
    countryIds: string[];
    tries: number;
    lastTryWasCorrect: boolean;
    individualCountryElements: (SVGGElement|SVGPathElement)[];
    svgDefs: SVGDefsElement;
    pickedCountry: SVGElement;
    spawnX: number;
    spawnY: number;
    viewBoxX: number;
    viewBoxY: number;
    svgWidth: number;
    svgHeight: number;
    map_svghtml: string;
    hammer: HammerManager;
    leaflet: L.Map;
    totalDraggedCountries: number;
    elementToMoveUseTo: SVGElement;
    getLevel() {
        return this.getValue(this.level);
    }
    getMode() {
        return this.getValue(this.mode);
    }
    isTypingLevel(): boolean {
        return this.getLevel() == MapLevel.TypeName || this.getLevel() == MapLevel.TypeNameWithNoOutlines;
    }
    constructor(protected mode: GameValue<T>, protected level: GameValue<MapLevel>, protected continentName?: GameValue<ValidContinents>) {
        super("", "", "OK");
        this.on("gt-cheat-click", () => {
            if(this.isTypingLevel() || this.getLevel() == MapLevel.PickNameFromList) {
                this.$title.text(this.getCountryName(this.targetCountryNode.id.replace(/-/g, ' ')));
            }
        });
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
        this.spawnX = 0;
        this.spawnY = 0;
        this.viewBoxX = 0;
        this.viewBoxY = 0;
        this.svgWidth = 0;
        this.svgHeight = 0;
        this.map_svghtml = null;
        this.hammer = null;
        this.clearCountryVars();
        await super.reset();
    }
    getMapForMode(): string {
        console.log("Continents = " + MapMode.Continents);
        if(this.getMode() == MapMode.Continents)
            return continents_map;
        else if(this.getMode() == MapMode.Countries || this.getMode() == MapMode.Capitals)
            return countries_map;
        else
            throw new Error("Unexpected mode: " + this.getMode());
    }
    getCountryName(baseName: string): string {
        if(this.getMode() == MapMode.Continents)
            return baseName;
        else {
            const c = country.findByIso2(baseName.toUpperCase());
            if(c != undefined) {
                if(this.getMode() == MapMode.Countries)
                    return c.name;
                else if(this.getMode() == MapMode.Capitals)
                    return c.capital;
                else
                    throw new Error("Unexpected mode");
            } else {
                throw new Error("Unable to retrieve country information for " + baseName.toUpperCase());
            }
        }
    }
    addTooltipToCountry(el: SVGElement, name?: string) {
        const code = el.id.replace(/-/g, ' ').toUpperCase();
        const c = country.findByIso2(code);
        if(name == undefined) {
            if(c != undefined) {
                if(this.getMode() == MapMode.Capitals)
                    name = c.name;
                else
                    name = `Name: ${c.name}, Capital: ${c.capital}`;
            } else if(this.getMode() != MapMode.Continents)
                throw new Error("Cannot infer country name for " + code);
            else
                name = el.id.replace(/-/g, ' ');
        }
        const tooltipTemplate = `<div class="tooltip map-tooltip" role="tooltip">
            <div class="arrow"></div>
            <div class="tooltip-inner"></div>
        </div>`;
        
        if(el.dataset.tooltipRegistered == "true") {
            $(el).attr("data-original-title", name).tooltip('_fixTitle');
        } else {
            el.dataset.tooltipRegistered = "true";
            $(el).tooltip({
                title: name,
                container: 'body',
                template: tooltipTemplate
            });
        }
        
        
        console.log("Tooltip registered for " + code);
    }
    getSingularNounForMode(): string {
        if(this.getMode() != MapMode.Countries) {
            const base = MapMode[this.getMode()].toLowerCase();
            return base.substr(0, base.length - 1);
        } else return "country";
    }
    isClickLevel(): boolean {
        const level = this.getLevel();
        return level == MapLevel.ClickCorrectOption || level == MapLevel.ClickCorrectOptionWithDisappearance;
    }
    clickHandler(el: SVGElement) {
        console.log(el.id);
        const name = this.getCountryName(el.id.replace(/-/g, ' '));
        if(this.getLevel() == MapLevel.LearnNames) {
            if(el.dataset.addedFill != "true") {
                el.dataset.addedFill = "true";
                this.addTooltipToCountry(el);
                el.style.fill = GameTools.getRandomArrayMember(d3.schemeDark2);
                el.style.stroke = el.style.fill;
                this.numClickedItems++;
                if(this.numClickedItems == this.maxItems)
                    this.$footer.show();
            }
            this.$progressBar.show();
            this.setProgress(this.numClickedItems / this.maxItems);
            this.$title.text(`The ${this.getSingularNounForMode()} is ${name}${this.numClickedItems == this.maxItems ? "; that's all of them!" : ` (${this.numClickedItems}/${this.maxItems})`}`);
            window.responsiveVoice.speak(name, 'US English Female');
        } else if(this.isClickLevel()) {
            if(this.targetCountryNode == null)
                return;
            if(el == this.targetCountryNode) {
                this.targetCountryNode.classList.remove("animate-correct-country");
                if(!this.isDisappearingLevel()) {
                    el.style.fill = GameTools.getRandomArrayMember(d3.schemeDark2);
                    el.style.stroke = el.style.fill;
                }
                this.svg_element.style.pointerEvents = "none";
                this.$title.text(`Yes, that's ${name}`);
                setTimeout(() => {
                    this.spawnCountry();
                    this.svg_element.style.pointerEvents = "auto";
                }, 2000);
            } else {
                this.$title.text(`No, that's ${name}, you need ${this.getCountryName(this.targetCountryNode.id.replace(/-/g, ' ').toUpperCase())}`);
                this.tries++;
                if(this.tries >= 3) {
                    this.targetCountryNode.classList.add("show-correct-country");
                    this.targetCountryNode.classList.add("animate-correct-country");
                }
            }
        }
        
    }
    async _undisplay() {
        GameTools.showTopBar(true);
        if(this.hammer != null)
            this.hammer.destroy();
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
        const rect = GameTools.normalizeRect(this.currentCountry.getBoundingClientRect());
        const div: HTMLDivElement = this.svg_element.parentElement as HTMLDivElement;
        const divRect = GameTools.normalizeRect(div.getBoundingClientRect());

        if(rect.width > divRect.width || rect.height > divRect.height)
            return;
        if(rect.right > divRect.right) {
            div.scrollLeft += rect.right - divRect.right;
        } else if(rect.left < divRect.left) {
            div.scrollLeft += rect.left - divRect.left;
        }
        if(rect.bottom > divRect.bottom) {
            div.scrollTop += rect.bottom - divRect.bottom;
        }
        if(rect.top < divRect.top) {
            div.scrollTop += rect.top - divRect.top;
        }
        /*
        div.scrollLeft = rect.right - divRect.left;
        div.scrollTop = rect.bottom - divRect.top;
        */
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
    isInputBasedLevel(): boolean {
        return this.getLevel() == MapLevel.PickNameFromList || this.isTypingLevel();
    }
    isDisappearingLevel(): boolean {
        return this.getLevel() == MapLevel.DragOptionWithDisappearance || this.getLevel() == MapLevel.ClickCorrectOptionWithDisappearance;
    }
    dragFinished(makeVisible = true) {
        if(this.currentCountry == null)
            return;
        const $button = this.$footer.find("button");
        $button.prop("disabled", true);
        var isCorrect = true;
        let $input: JQuery;
        if(this.isInputBasedLevel()) {
            if(this.isTypingLevel()) {
                $input = this.$content.find("input");
                const val: string = ($input.val() as string).toLowerCase();
                if(val.length > 3 || val.length < 3) {
                    isCorrect = false;
                } else {
                    const answer = this.getCountryName(this.targetCountryNode.getAttribute("id").toUpperCase()).toLowerCase().substr(0, 3);
                    if(val != answer) {
                        isCorrect = false;
                        console.log("Expected " + answer);
                    }
                }
            } else if(this.getLevel() == MapLevel.PickNameFromList) {
                $input = this.$content.find(".dropdown-toggle");
                isCorrect = this.pickedCountry == this.targetCountryNode;
            } else
                throw new Error("Shouldn't get here");
            const hadFocus = (document.activeElement == $input.get(0));
            $input.prop("disabled", true);
            if(isCorrect) {
                this.$title.text("Yes! That's right!");
                this.targetCountryNode.classList.remove("input-country");
                this.targetCountryNode.style.fill = GameTools.getRandomArrayMember(d3.schemeDark2);
                this.targetCountryNode.style.stroke = this.targetCountryNode.style.fill;
                setTimeout(() => {
                    if(this.isTypingLevel())
                        $input.val("");
                    this.spawnCountry();
                    $input.prop("disabled", false);
                    if(GameTools.notScrollable(this.svg_element.parentElement))
                        $input.focus();
                }, 2000);
            } else {
                if(makeVisible) {
                    GameTools.animateCSS(this.$dialog.find(".modal-dialog").get(0), "shake");
                    if(this.getMode() != MapMode.Capitals)
                        this.$title.text("Hmm.. that doesn't seem right.");
                    else {
                        const info = this.getCountryInfo(this.pickedCountry);
                        this.$title.text(`No, ${info.capital} is the capital of ${info.name}.`);
                    }
                    this.tries++;
                    console.log("Tries incremented");
                    if(this.tries >= 3) {
                        this.$title.text(`The ${this.getSingularNounForMode()}${this.getMode() == MapMode.Capitals ? ` of ${this.getCountryInfo(this.targetCountryNode).name} ` : ""} is ${this.getCountryName(this.targetCountryNode.id.replace(/-/g, ' '))}`);
                    }
                }
                $button.prop("disabled", false);
                $input.prop("disabled", false);
                if(hadFocus)
                    $input.focus();
            }
            this.lastTryWasCorrect = isCorrect;
        } else {
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
                if(distance >= 10) {
                    console.log("Bad distance");
                    isCorrect = false;
                }
            }
            console.log("Correct: " + isCorrect);
            if(isCorrect) {
                const wasWrong = this.targetCountry.node().classList.contains("show-correct-country");
                this.targetCountry.node().classList.remove("show-correct-country");
                this.targetCountry.node().classList.remove("animate-correct-country");
                this.$title.text("Nice work! Let's do another one...");
                window.responsiveVoice.speak(GameTools.getRandomArrayMember(GameTools.encouragingPhrases), 'US English Female');
                this.transformX = 0;
                this.transformY = 0;
                this.updateCountryVals(this.currentCountry);
                if(this.elementToMoveUseTo != null)
                    this.svg_element.insertBefore(this.currentCountry, this.elementToMoveUseTo);
                if(!wasWrong) {
                    this.countrySource.style.fill = GameTools.getRandomArrayMember(d3.schemeDark2);
                    this.countrySource.style.stroke = this.countrySource.style.fill;
                    this.countrySource.classList.remove("animate-correct-country");
                } else {
                    this.countrySource.classList.add("show-correct-country");
    
                }
                this.currentUseSelection.on(".drag", null);
                this.currentUseSelection.node().classList.remove("current-country");
                if(!wasWrong && this.isDisappearingLevel()) {
                    const node = this.currentUseSelection.node();
                    node.parentNode.removeChild(node);
                }
                this.clearCountryVars();
                setTimeout(() => {
                    this.spawnCountry();
                    $button.prop("disabled", false);
                }, 1000);
            } else {
                function changeTitle(this: DragDropSVGMap) {
                    this.$title.text("Hmm... not quite. Give it another try!");
                    if(this.tries >= 2) {
                        if(this.currentSize < 1)
                            this.$title.text("That seems small...");
                        else if(this.currentSize > 1)
                            this.$title.text("That seems a bit big!");
                        else if(this.badRotation())
                            this.$title.text("Rotation is key.");
                        else if(distance >= 10)
                            this.$title.text("Everything is right except for the position.");
                    }
                }
                changeTitle.call(this);
                /*
                window.requestAnimationFrame(() => {
                    const box = this.currentCountry.getBBox();
                    box.x += this.transformX;
                    box.y += this.transformY;
                    box.x -= this.viewBoxX;
                    box.y -= this.viewBoxY;
                    if(box.x < 0)
                        this.transformX += -box.x;
                    if(box.y < 0)
                        this.transformY += -box.y;
                    if(box.x > this.svgWidth)
                        this.transformX -= (box.width+(box.x-this.svgWidth));
                    if(box.y > this.svgHeight)
                        this.transformY -= (box.height+(box.y-this.svgHeight));
                    this.updateCountryVals(this.currentCountry);
                });
                */
                if(this.tries >= 3) {
                    this.targetCountry.node().classList.add("show-correct-country");
                    this.targetCountry.node().classList.add("animate-correct-country");
                    console.log(this.targetCountry.node());
                    this.$title.text("Alright; the correct location is now highlighted.");
                }
                $button.prop("disabled", false);
            }
        }
    }
    buttonCallback(e: JQuery.ClickEvent) {
        if(this.getLevel() == MapLevel.PickNameFromList) {
            const id = (e.target as HTMLElement).dataset.orgId;
            console.log("Clicked id " + id);
            this.pickedCountry = this.svg_element.querySelector(id);
            this.dragFinished();
        } else if(this.getLevel() != MapLevel.LearnNames) {
            this.tries++;
            this.dragFinished();
        } else {
            $(e.target).prop("disabled", true);
            this.displayNext();
        }
    }
    getCountryInfo(el: SVGElement) {
        return country.findByIso2(el.id.replace(/-/g, ' ').toUpperCase());
    }
    isBasicDragOption(): boolean {
        return this.getLevel() == MapLevel.DragOptionToCorrectLocation || this.getLevel() == MapLevel.DragOptionWithDisappearance;
    }
    spawnCountry() {
        const setTitle = (opt?: string) => {
            opt = GameTools.pl_undef(opt, "");
            if(this.isClickLevel())
                this.$title.text(`Click on ${opt}`);
            else {
                var namingPortion;
                if(this.getMode() == MapMode.Capitals)
                    namingPortion = `${country.findByIso2(this.targetCountry.node().dataset.oldId.replace(/-/g, ' ').toUpperCase()).capital} and its country`;
                else {
                    namingPortion = `${this.getCountryName(this.targetCountry.node().dataset.oldId.replace(/-/g, ' ').toUpperCase())}`;
                }
                this.$title.text(`${this.isBasicDragOption() ? "Drag" : "Manipulate"} ${namingPortion} into position.`);
            }
        };
        
        if(this.countryIds.length == 0) {
            /* End the whole thing */
            this.clearCountryVars();
            this.displayNext();
            return;
        }
        
        this.tries = 0;
        const oldId = GameTools.getRandomArrayMember(this.countryIds);
        this.$progressBar.show();
        this.setProgress((this.totalDraggedCountries - this.countryIds.length) / this.totalDraggedCountries);
        this.countryIds.splice(this.countryIds.indexOf(oldId), 1);
        if(this.isClickLevel()) {
            this.targetCountryNode = this.svg_element.querySelector(oldId);
            setTitle(this.getCountryName(oldId.substr(1).replace(/-/g, ' ')));
        } else if(!this.isInputBasedLevel()) {
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
            if(this.svg_element.querySelector(oldId).querySelector("circle") != null || this.getMode() == MapMode.Continents) {
                
                this.elementToMoveUseTo = null;
            } else {
                const circleDivider = this.svg_element.querySelector("#gt-svg-circle-divider");
                console.log(circleDivider);
                if(circleDivider == null)
                    throw new Error("Circle divider is null");
                this.elementToMoveUseTo = circleDivider as SVGElement;
            }
            this.svg_element.appendChild(this.currentCountry);
            this.currentUseSelection = d3.select(this.currentCountry);
            this.currentUseSelection
                .attr("href", oldId)
                .attr("x", this.spawnX)
                .attr("y", this.spawnY);
            this.currentCountry.classList.add("current-country");
            const _self = this;
            this.currentUseSelection.call(d3.drag().subject(() => {
                return { x: this.transformX, y: this.transformY }; 
            }).on("drag", function(d: any) {
                _self.transformX = d3.event.x;
                _self.transformY = d3.event.y;
                _self.updateCountryVals(_self.currentCountry);
            }).on("start", function() {
                _self.svg_element.style.touchAction = "none";
                d3.event.sourceEvent.preventDefault();
            }).on("end", () => {
                this.svg_element.style.touchAction = '';
                //this.dragFinished(); // no easy way to get hints??
                /*
                if(!this.lastTryWasCorrect)
                    setTitle();
                    */
            }));
            if(!this.isBasicDragOption()) {
                this.currentRotation = GameTools.getRandomInt(-7, 7) * 45;
                if(this.currentCountry.querySelector("circle") != null)
                    this.currentSize = 1;
                else
                    this.currentSize = 1 + (GameTools.getRandomInt(-1, 4) * 0.25);
                this.svg_element.classList.add("hide-country-borders");
            } else {
                this.currentRotation = 0;
                this.currentSize = 1;
                if(this.getLevel() == MapLevel.DragOptionWithDisappearance)
                    this.svg_element.classList.add("hide-country-borders");
            }
            setTitle();
            this.transformX = 0;
            this.transformY = 0;
            console.log("Size: " + this.currentSize);
            window.requestAnimationFrame(() => {
                const box = this.currentCountry.getBBox();
                console.log(box);
                this.transformX = 20-(box.x-this.viewBoxX);
                this.transformY = 20-(box.y-this.viewBoxY);
                this.updateCountryVals(this.currentCountry);
                const mapdiv = this.$content.find(".gt-svgmap-map-div").get(0);
                mapdiv.scrollLeft = 0;
                mapdiv.scrollTop = 0;
            });
        } else {
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
            if(this.isTypingLevel()) {
                if(this.getMode() == MapMode.Capitals) {
                    this.$title.text(`Type the first three letters of ${possessive(this.getCountryInfo(this.targetCountryNode).name)} capital's name.`);
                } else
                    this.$title.text(`Type the first three letters of this ${possessive(this.getSingularNounForMode())} name.`);
            } else if(this.getLevel() == MapLevel.PickNameFromList) {
                if(this.getMode() == MapMode.Capitals) {
                    this.$title.text(`What is the name of ${possessive(this.getCountryInfo(this.targetCountryNode).name)} capital?`);
                } else {
                    this.$title.text(`What ${this.getSingularNounForMode()} is highlighted in yellow and outlined in blue?`);
                }
            } else
                throw new Error("Should not be here");
            this.targetCountryNode.classList.add("input-country");
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
        this.$title.parent().find(".close").remove();
        const response = await fetch(this.getMapForMode());
        this.map_svghtml = await response.text();
        this.$dialog.find(".modal-dialog").addClass("modal-dialog-scrollable");
    }
    static hammerIt(elm: HTMLElement|SVGElement) {
        var hammertime = new Hammer(elm, {});
        hammertime.get('pinch').set({
            enable: true
        });
        var posX = 0,
            posY = 0,
            scale = 1,
            last_scale = 1,
            last_posX = 0,
            last_posY = 0,
            max_pos_x = 0,
            max_pos_y = 0,
            transform = "",
            el = elm;
    
        hammertime.on('doubletap pan pinch panend pinchend', function(ev) {
            console.log(ev);
            if (ev.type == "doubletap") {
                transform =
                    "translate3d(0, 0, 0) " +
                    "scale3d(2, 2, 1) ";
                scale = 2;
                last_scale = 2;
                try {
                    if (window.getComputedStyle(el, null).getPropertyValue('transform').toString() != "matrix(1, 0, 0, 1, 0, 0)") {
                        transform =
                            "translate3d(0, 0, 0) " +
                            "scale3d(1, 1, 1) ";
                        scale = 1;
                        last_scale = 1;
                    }
                } catch (err) {}
                el.style.transform = transform;
                transform = "";
            }
    
            //pan    
            if (scale != 1) {
                posX = last_posX + ev.deltaX;
                posY = last_posY + ev.deltaY;
                max_pos_x = Math.ceil((scale - 1) * el.clientWidth / 2);
                max_pos_y = Math.ceil((scale - 1) * el.clientHeight / 2);
                if (posX > max_pos_x) {
                    posX = max_pos_x;
                }
                if (posX < -max_pos_x) {
                    posX = -max_pos_x;
                }
                if (posY > max_pos_y) {
                    posY = max_pos_y;
                }
                if (posY < -max_pos_y) {
                    posY = -max_pos_y;
                }
            }
    
    
            //pinch
            if (ev.type == "pinch") {
                scale = Math.max(.999, Math.min(last_scale * (ev.scale), 4));
            }
            if(ev.type == "pinchend"){last_scale = scale;}
    
            //panend
            if(ev.type == "panend"){
                last_posX = posX < max_pos_x ? posX : max_pos_x;
                last_posY = posY < max_pos_y ? posY : max_pos_y;
            }
    
            if (scale != 1) {
                transform =
                    "translate3d(" + posX + "px," + posY + "px, 0) " +
                    "scale3d(" + scale + ", " + scale + ", 1)";
            }
    
            if (transform) {
                el.style.transform = transform;
            }
        });
    }
    fixupElement() {
        /* Bind zoom, touch, etc. */
        //DragDropSVGMap.hammerIt(this.svg_element);
        //this.hammer = new Hammer(this.svg_element);
        /*
        this.hammer.on('pan', (ev) => {
            if((ev.target as Element) != this.svg_element)
                return;
            this.svg_element.parentElement.scrollLeft += -ev.deltaX;
            this.svg_element.parentElement.scrollTop += -ev.deltaY;
        });
        */
        this.svg_element.querySelectorAll("style").forEach(style => style.parentNode.removeChild(style));
        if(this.getMode() != MapMode.Continents) {
            this.svg_element.removeAttribute("width");
            this.svg_element.removeAttribute("height");

            this.svg_element.querySelectorAll("title").forEach((title) => title.parentNode.removeChild(title));

            this.svg_element.querySelectorAll(".oceanxx").forEach((ocean) => ocean.parentNode.removeChild(ocean));
            this.svg_element.querySelectorAll(".coastxx").forEach((coast) => coast.classList.remove("coastxx"));
            this.svg_element.querySelectorAll(".limitxx").forEach((coast) => coast.classList.remove("limitxx"));
            this.svg_element.querySelectorAll("g[id]").forEach((g: SVGGElement|SVGPathElement) => {
                Array.from(g.children).forEach((child) => {
                    const c = country.findByIso2(child.id.toUpperCase());
                    if(c != undefined) {
                        this.svg_element.appendChild(child);
                    }
                });
            });
            this.svg_element.querySelectorAll("#xa, #xn, #xj, #xd, #xk, #xl, #xc, #xz, #xs, #xo, #xp, #xq, #easter_island").forEach((idElement) => {
                idElement.parentNode.removeChild(idElement);
            });
            
            if(this.getMode() != MapMode.Continents && this.continentName == undefined)
                throw new Error("Continent name must be provided");
            this.svg_element.querySelectorAll("g[id], path[id]").forEach((g: SVGGElement|SVGPathElement) => {
                if(g.id.startsWith("path"))
                    return;
                if(g.parentNode != this.svg_element)
                    return;

                const c = country.findByIso2(g.id.toUpperCase());
                if(c == undefined || (c != undefined && c.continent != DisplayedItem.getValue(null, this.continentName))) {
                    if(c == undefined)
                        console.log("NO INFO: " + g.id);
                    g.parentNode.removeChild(g);
                    return;
                }
            });

            
            const circleDivider = document.createElementNS("http://www.w3.org/2000/svg", "g");
            circleDivider.setAttribute("id", "gt-svg-circle-divider");
            circleDivider.style.display = "none";
            this.svg_element.appendChild(circleDivider);
            this.svg_element.querySelectorAll("circle").forEach(circle => {
                circle.setAttribute("r", "8");
                /* Push circles to the top */
                let g: SVGElement = circle;
                do {
                    g = (g.parentNode as SVGElement); 
                } while(g != null && g.parentNode != this.svg_element);
                if(0)
                    this.svg_element.appendChild(g);
                else if(g != null)
                    this.svg_element.removeChild(g);
            });
        } else {
            Array.from(this.svg_element.children).forEach((child) => {
                if(child.nodeType == Node.ELEMENT_NODE) {
                    child.setAttribute("style", "stroke-width: 80;");
                }
            });
        }
    }
    async calcSvgViewBox(): Promise<void> {
        if(this.getMode() == MapMode.Continents)
            return;
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                console.log("Calculating svg viewBox");
                let rect: Flatten.Box = null;
                this.svg_element.querySelectorAll("g[id], path[id]").forEach((g: (SVGGElement|SVGPathElement)) => {
                    if(g.parentElement.tagName.toLowerCase() != "svg") return;
                    if(g.style.display == "none") return;
                    const box = g.getBBox();
                    const boxFlatten = new Flatten.Box(box.x, box.y, box.x + box.width, box.y + box.height);
                    if(rect == null)
                        rect = boxFlatten;
                    else
                        rect = rect.merge(boxFlatten);
                });
                /* Set viewBox */
                this.svgWidth = rect.xmax - rect.xmin + 1;
                this.svgHeight = rect.ymax - rect.ymin + 1;
                this.svg_element.setAttribute("viewBox", `${rect.xmin} ${rect.ymin} ${this.svgWidth} ${this.svgHeight}`);
                this.viewBoxX = rect.xmin;
                this.viewBoxY = rect.ymin;
                resolve();
            });
        });
    }
    easyPz(div: HTMLDivElement) {
        div.appendChild(this.svg_element);
        const panzoom = Panzoom(this.svg_element, {
            maxScale: 5,
            minScale: 0,
            animate: true,
            contain: "outside"
        });
        /*
        panzoom.pan(10, 10);
        panzoom.zoom(2);
        */
        panzoom.zoom(2);
        /*
        // Panning and pinch zooming are bound automatically (unless disablePan is true).
        // There are several available methods for zooming
        // that can be bound on button clicks or mousewheel.
        button.addEventListener('click', panzoom.zoomIn)
        */
        div.addEventListener('wheel', panzoom.zoomWithWheel);
    }
    async dialogDisplayed() {
        await super.dialogDisplayed();
        if(!this.isInputBasedLevel()) {
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
            map_div.append(this.map_svghtml);
            this.$content.addClass("gt-svgmap");
            this.svg_element = (this.$content.find('svg').get(0) as any);
            this.fixupElement();
            this.orig = this.svg_element;
            if(this.getMode() == MapMode.Continents)
                this.svg_element.classList.add("continents-svg");
            else {
                await this.calcSvgViewBox();
            }
            if(this.getMode() == MapMode.Capitals) {

            }
            const d3el = d3.select(this.svg_element);
            Array.from(this.svg_element.children).forEach((child) => {
                const tag = child.tagName.toLowerCase();
                if((tag == "g" || tag == "path") && child.getAttribute("id") != "gt-svg-circle-divider") {
                    child.classList.add("background-country");
                }
            });
            const backgroundCountries = d3.selectAll(".background-country");
            
            const _self = this;
            backgroundCountries.each(function(this: SVGGElement) {
                this.classList.add("background-country");
            });
            this.countryIds = [];
            backgroundCountries.each(function(this: SVGGElement) {
                _self.countryIds.push("#" + this.getAttribute("id"));
            });
            this.totalDraggedCountries = this.countryIds.length;
            if(this.getLevel() == MapLevel.LearnNames || this.isClickLevel()) {
                if(this.getLevel() == MapLevel.LearnNames)
                    this.$title.text(`Click the ${pluralize(this.getSingularNounForMode())} to learn their names!`);
                this.$footer.hide();
                controls_div.remove();
                backgroundCountries.each(function(this: SVGGElement) {
                    this.style.cursor = 'pointer';
                });
                let itemSelection: d3.Selection<SVGElement, unknown, Element, unknown>;
                itemSelection = d3el.selectAll(".background-country");
                backgroundCountries.each(function(this: SVGGElement) {
                    this.classList.remove("background-country");
                    this.classList.add("hoverable-country");
                    if(_self.getMode() == MapMode.Capitals)
                        _self.addTooltipToCountry(this);
                });
                this.maxItems = itemSelection.size();
                if(this.isClickLevel())
                    this.spawnCountry();
                itemSelection.on("click", function(this: SVGElement) {
                    _self.clickHandler(this);
                });
            } else {
                if(this.isBasicDragOption())
                    controls_div.remove();
                this.spawnCountry();
                if(this.currentCountry != null)
                    this.currentCountry.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center'});
            }
        } else {
            var parser = new DOMParser();
            var doc = parser.parseFromString(this.map_svghtml, "image/svg+xml");
            this.svg_element = doc.documentElement as unknown as SVGSVGElement;
            this.fixupElement();
            this.countryIds = [];
            this.individualCountryElements = [];
            const map_div = document.createElement("div");
            map_div.classList.add("gt-svgmap-map-div");
            this.svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            this.currentCountry = document.createElementNS("http://www.w3.org/2000/svg", "use");
            this.svg_element.classList.add("gt-svgmap-country-svg");
            this.svg_element.appendChild(this.svgDefs);
            this.svg_element.appendChild(this.currentCountry);
            Array.from(this.svg_element.children).forEach((child) => {
                const tag = child.tagName.toLowerCase();
                if((tag == "g" || tag == "path") && child.getAttribute("id") != "gt-svg-circle-divider") {
                    this.countryIds.push("#" + child.getAttribute("id"));
                    console.log("Adding" + child.getAttribute("id"));
                    this.individualCountryElements.push(child as (SVGGElement|SVGPathElement));
                }
            });
            this.individualCountryElements.forEach((element) => {
                const circle = element.querySelector("circle");
                if(circle != null) {
                    element.insertBefore(circle, element.firstChild);
                }
            });
            map_div.appendChild(this.svg_element);
            const flexbox = document.createElement("div");
            $(flexbox).addClass("gt-svgmap-flexbox flex-column");
            flexbox.appendChild(map_div);
            this.$content.append(flexbox).addClass("gt-svgmap");
            await this.calcSvgViewBox();
            /*
            if(this.getMode() != MapMode.Continents)
               this.easyPz(map_div);
               */
            if(this.isTypingLevel()) {
                $(flexbox).prepend($("<input></input>").attr("type", "text").attr("maxlength", "3").attr("placeholder", "Enter country name").addClass("form-control").on("input", () => this.dragFinished(false)).on("keyup", (e) => {
                    if(e.which == 13)
                        this.dragFinished(true);
                }));
                if(this.getLevel() == MapLevel.TypeNameWithNoOutlines)
                    this.svg_element.classList.add("hide-country-borders");
            } else {
                this.$footer.hide();
                const dropDown = $("<div></div>").addClass("dropdown");
                const button = $("<button></button>").addClass("btn btn-secondary dropdown-toggle").text(`Choose a ${this.getSingularNounForMode()}`).attr("data-toggle", "dropdown");
                dropDown.append(button);
                const menu = $("<div></div>").addClass("dropdown-menu h-auto").css({
                    "overflow-x": "hidden",
                    "max-height": "50vh"
                });
                sortBy(this.countryIds.map((id) => {
                    const obj = { oldId: id, newName: this.getCountryName(id.substr(1).replace(/-/g, ' ')) };
                    console.log(obj);
                    return obj;
                }), [ function(o) { return o.newName; } ]).forEach((obj) => {
                    menu.append($("<a></a>").addClass("dropdown-item").attr("href", "javascript:void(0);").text(obj.newName).attr("data-org-id", obj.oldId).click((e) => this.buttonCallback(e)));
                });
                dropDown.append(menu);
                $(flexbox).prepend(dropDown);
                button.dropdown();
            }
            this.spawnCountry();
        }
    }
}
export default DragDropSVGMap;