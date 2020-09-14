/// <reference types="d3"/>
/// <reference types="pluralize"/>
/// <reference path="./components/gametools/gametools.d.ts"/>
import InfoBox from "./components/gametools/InfoBox";

import GameTools from "./components/gametools/GameTools";

import DisplayedItem, { GameValue } from "./components/gametools/DisplayedItem";

const countries_map = require('./BlankMap-World.svg');

const continents_map = require('./continents.svg');

import possessive from './components/possessive';

import 'whatwg-fetch';

const country = require('country-list-js');

import Box2D from "./components/gametools/Box2D";

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
    private static readonly outlineStroke: string = "rgb(0, 0, 0)";
    private static readonly correctColor: string = "rgb(133, 186, 0)";
    mapResponse: Promise<Response>;
    numClickedItems: number;
    maxItems: number;
    $bottomButton: JQuery;
    orig: SVGElement;
    lockout = false;
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
    totalDraggedCountries: number;
    elementToMoveUseTo: SVGElement;
    static getCorrectColor(): string {
        // GameTools.getRandomArrayMember(GameTools.assertProperty(globalThis, "d3").schemeDark2);
        return DragDropSVGMap.correctColor;
    }
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
        this.clearCountryVars();
        await super.reset();
    }
    getMapForMode(): string {
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
    addTooltipToCountry(el: SVGElement, code?: string, name?: string) {
        if(code == undefined)
            code = el.id.replace(/-/g, ' ');
        code = code.toUpperCase();
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
        
        if(el.getAttribute("data-tooltip-registered") == "true") {
            $(el).attr("data-original-title", name).tooltip('_fixTitle');
        } else {
            el.setAttribute("data-tooltip-registered", "true");
            $(el).tooltip({
                title: name,
                container: 'body',
                template: tooltipTemplate
            });
        }
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
        const name = this.getCountryName(el.id.replace(/-/g, ' '));
        if(this.getLevel() == MapLevel.LearnNames) {
            if(el.getAttribute("data-added-fill") != "true") {
                el.setAttribute("data-added-fill", "true");
                this.addTooltipToCountry(el);
                el.style.fill = DragDropSVGMap.getCorrectColor(); 
                el.style.stroke = DragDropSVGMap.outlineStroke;
                this.numClickedItems++;
                if(this.numClickedItems == this.maxItems)
                    this.$footer.show();
            }
            this.$progressBar.show();
            this.setProgress(this.numClickedItems / this.maxItems);
            this.$title.text(`The ${this.getSingularNounForMode()} is ${name}${this.numClickedItems == this.maxItems ? "; that's all of them!" : ` (${this.numClickedItems}/${this.maxItems})`}`);
            GameTools.assertProperty(window, "responsiveVoice").speak(name, 'US English Female');
        } else if(this.isClickLevel()) {
            if(this.targetCountryNode == null)
                return;
            if(el == this.targetCountryNode) {
                $(this.targetCountryNode).removeClass("animate-correct-country");
                if(!this.isDisappearingLevel()) {
                    el.style.fill = DragDropSVGMap.getCorrectColor();
                    el.style.stroke = DragDropSVGMap.outlineStroke;
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
                    $(this.targetCountryNode).addClass("show-correct-country");
                    $(this.targetCountryNode).addClass("animate-correct-country");
                }
            }
        }
        
    }
    async _undisplay() {
        GameTools.showTopBar(true);
        await super._undisplay();
    }
    async display() {
        this.mapResponse = fetch(this.getMapForMode());
        await super.display();
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
        const div: HTMLDivElement = this.svg_element.parentNode as HTMLDivElement;
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
                this.lockout = true;
                this.$title.text("Yes! That's right!");
                $(this.targetCountryNode).removeClass("input-country");
                this.targetCountryNode.style.fill = DragDropSVGMap.getCorrectColor();
                this.targetCountryNode.style.stroke = DragDropSVGMap.outlineStroke;
                setTimeout(() => {
                    if(this.isTypingLevel())
                        $input.val("");
                    this.spawnCountry();
                    $input.prop("disabled", false);
                    if(GameTools.notScrollable(this.svg_element.parentNode as Element))
                        $input.focus();
                }, 2000);
            } else {
                if(makeVisible) {
                    GameTools.animateCSS(this.$dialog.find(".modal-dialog").get(0), "shake");
                    if(this.getMode() != MapMode.Capitals) {
                        this.$title.text("Hmm.. that doesn't seem right.");
                    } else {
                        if(this.pickedCountry != null) {
                            const info = this.getCountryInfo(this.pickedCountry);
                            this.$title.text(`No, ${info.capital} is the capital of ${info.name}.`);
                        } else {
                            this.$title.text(`Incorrect!`);
                        }
                    }
                    setTimeout(() => {
                        if(this.isDisplaying() && !this.lockout)
                            this.resetQuestionTitle();
                    }, 2000);
                    this.tries++;
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
                isCorrect = false;
            } else if(this.badRotation()) {
                isCorrect = false;
            } else {
                /* Find distance */
                if(distance >= 10) {
                    isCorrect = false;
                }
            }

            if(isCorrect) {
                const wasWrong = $(this.targetCountry.node()).hasClass("show-correct-country");
                $(this.targetCountry.node()).removeClass("show-correct-country");
                $(this.targetCountry.node()).removeClass("animate-correct-country");
                this.$title.text("Nice work! Let's do another one...");
                window.responsiveVoice.speak(GameTools.getRandomArrayMember(GameTools.encouragingPhrases), 'US English Female');
                this.transformX = 0;
                this.transformY = 0;
                this.updateCountryVals(this.currentCountry);
                this.addTooltipToCountry(this.currentCountry, this.currentCountry.getAttribute("href").substr(1));
                if(this.elementToMoveUseTo != null)
                    this.svg_element.insertBefore(this.currentCountry, this.elementToMoveUseTo);
                if(!wasWrong) {
                    this.countrySource.style.fill = DragDropSVGMap.getCorrectColor();
                    this.countrySource.style.stroke = DragDropSVGMap.outlineStroke;
                    $(this.countrySource).removeClass("animate-correct-country");
                } else {
                    $(this.countrySource).addClass("show-correct-country");
    
                }
                this.currentUseSelection.on(".drag", null);
                $(this.currentUseSelection.node()).removeClass("current-country");
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
                        else if(distance >= 10) {
                            if(this.getLevel() == MapLevel.DragAndSizeOption)
                                this.$title.text("Everything is right except for the position.");
                            else
                                this.$title.text("It's not in the right spot.");
                        }
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
                    $(this.targetCountry.node()).addClass("show-correct-country");
                    $(this.targetCountry.node()).addClass("animate-correct-country");
                    this.$title.text("Alright, the correct location is now highlighted.");
                }
                $button.prop("disabled", false);
            }
        }
    }
    buttonCallback(e: JQuery.ClickEvent) {
        if(this.getLevel() == MapLevel.PickNameFromList) {
            const id = (e.target as HTMLElement).getAttribute("data-org-id");
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
        this.lockout = false;
        const setTitle = (opt?: string) => {
            opt = GameTools.pl_undef(opt, "");
            if(this.isClickLevel()) {
                if(this.getMode() == MapMode.Capitals) {
                    this.$title.text(`Click on the country whose capital is ${opt}`);
                } else {
                    this.$title.text(`Click on ${opt}`);
                }
            } else {
                var namingPortion;
                if(this.getMode() == MapMode.Capitals)
                    namingPortion = `${country.findByIso2(this.targetCountry.node().getAttribute("data-old-id").replace(/-/g, ' ').toUpperCase()).capital} and its country`;
                else {
                    namingPortion = `${this.getCountryName(this.targetCountry.node().getAttribute("data-old-id").replace(/-/g, ' ').toUpperCase())}`;
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
            this.targetCountry = GameTools.assertProperty(globalThis, "d3").select(this.svg_element).select(oldId);
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            this.svg_element.appendChild(defs);
            this.countrySource = this.cloneAndAppendToElement(this.svg_element, this.targetCountry, defs);
            $(this.countrySource).addClass("current-country-source");
            $(this.countrySource).removeClass("background-country");
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
                if(circleDivider == null)
                    throw new Error("Circle divider is null");
                this.elementToMoveUseTo = circleDivider as SVGElement;
            }
            this.svg_element.appendChild(this.currentCountry);
            this.currentUseSelection = GameTools.assertProperty(globalThis, "d3").select(this.currentCountry);
            this.currentUseSelection
                .attr("href", oldId)
                .attr("x", this.spawnX)
                .attr("y", this.spawnY);
            $(this.currentCountry).addClass("current-country");
            const _self = this;
            this.currentUseSelection.call(GameTools.assertProperty(globalThis, "d3").drag().subject(() => {
                return { x: this.transformX, y: this.transformY }; 
            }).on("drag", function(d: any) {
                _self.transformX = GameTools.assertProperty(globalThis, "d3").event.x;
                _self.transformY = GameTools.assertProperty(globalThis, "d3").event.y;
                _self.updateCountryVals(_self.currentCountry);
            }).on("start", function() {
                _self.svg_element.style.touchAction = "none";
                GameTools.assertProperty(globalThis, "d3").event.sourceEvent.preventDefault();
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
                $(this.svg_element).addClass("hide-country-borders");
            } else {
                this.currentRotation = 0;
                this.currentSize = 1;
                if(this.getLevel() == MapLevel.DragOptionWithDisappearance)
                    $(this.svg_element).addClass("hide-country-borders");
            }
            setTitle();
            this.transformX = 0;
            this.transformY = 0;
            window.requestAnimationFrame(() => {
                const box = this.currentCountry.getBBox();
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
            this.resetQuestionTitle();
            $(this.targetCountryNode).addClass("input-country");
        }
        
    }
    resetQuestionTitle() {
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
        //this.$footer.find("button").remove();
        const response = await this.mapResponse;
        this.map_svghtml = await response.text();
        this.$dialog.find(".modal-dialog").addClass("modal-dialog-scrollable");
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
            this.svg_element.querySelectorAll(".coastxx").forEach((coast) => $(coast).removeClass("coastxx"));
            this.svg_element.querySelectorAll(".limitxx").forEach((coast) => $(coast).removeClass("limitxx"));
            this.svg_element.querySelectorAll("g[id]").forEach((g: SVGGElement|SVGPathElement) => {
                Array.from(g.childNodes).forEach((child) => {
                    if(child.nodeType != Node.ELEMENT_NODE)
                        return;
                    const c = country.findByIso2((child as Element).id.toUpperCase());
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
            Array.from(this.svg_element.childNodes).forEach((child) => {
                if(child.nodeType == Node.ELEMENT_NODE) {
                    (child as Element).setAttribute("style", "stroke-width: 80;");
                }
            });
        }
    }
    async calcSvgViewBox(): Promise<void> {
        if(this.getMode() == MapMode.Continents)
            return;
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                let rect: Box2D = null;
                this.svg_element.querySelectorAll("g[id], path[id]").forEach((g: (SVGGElement|SVGPathElement)) => {
                    if((g.parentNode as Element).tagName.toLowerCase() != "svg") return;
                    if(g.style.display == "none") return;
                    const box = g.getBBox();
                    const boxFlatten = new Box2D(box.x, box.y, box.x + box.width, box.y + box.height);
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
                $(this.svg_element).addClass("continents-svg");
            else {
                await this.calcSvgViewBox();
            }
            if(this.getMode() == MapMode.Capitals) {

            }
            const d3el = GameTools.assertProperty(globalThis, "d3").select(this.svg_element);
            Array.from(this.svg_element.childNodes).forEach((child) => {
                if(child.nodeType != Node.ELEMENT_NODE)
                    return;
                const tag = (child as Element).tagName.toLowerCase();
                if((tag == "g" || tag == "path") && (child as Element).getAttribute("id") != "gt-svg-circle-divider") {
                    $(child).addClass("background-country");
                }
            });
            const backgroundCountries = GameTools.assertProperty(globalThis, "d3").selectAll(".background-country");
            
            const _self = this;
            backgroundCountries.each(function(this: SVGGElement) {
                $(this).addClass("background-country");
            });
            this.countryIds = [];
            backgroundCountries.each(function(this: SVGGElement) {
                _self.countryIds.push("#" + this.getAttribute("id"));
            });
            this.totalDraggedCountries = this.countryIds.length;
            if(this.getLevel() == MapLevel.LearnNames || this.isClickLevel()) {
                if(this.getLevel() == MapLevel.LearnNames)
                    this.$title.text(`Click the ${GameTools.assertProperty(globalThis, "pluralize")(this.getSingularNounForMode())} to learn their names!`);
                this.$footer.hide();
                controls_div.remove();
                backgroundCountries.each(function(this: SVGGElement) {
                    this.style.cursor = 'pointer';
                });
                let itemSelection: d3.Selection<SVGElement, unknown, Element, unknown>;
                itemSelection = d3el.selectAll(".background-country");
                backgroundCountries.each(function(this: SVGGElement) {
                    $(this).removeClass("background-country");
                    $(this).addClass("hoverable-country");
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
            $(map_div).addClass("gt-svgmap-map-div");
            this.svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            this.currentCountry = document.createElementNS("http://www.w3.org/2000/svg", "use");
            $(this.svg_element).addClass("gt-svgmap-country-svg");
            this.svg_element.appendChild(this.svgDefs);
            this.svg_element.appendChild(this.currentCountry);
            Array.from(this.svg_element.childNodes).forEach((node) => {
                if(node.nodeType != Node.ELEMENT_NODE)
                    return;
                const child: Element = node as Element;
                const tag = child.tagName.toLowerCase();
                if((tag == "g" || tag == "path") && child.getAttribute("id") != "gt-svg-circle-divider") {
                    this.countryIds.push("#" + child.getAttribute("id"));
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
                $(flexbox).prepend($("<input></input>").attr("type", "text").attr("maxlength", "3").attr("placeholder", "Enter country name").addClass("form-control")/*.on("input", () => this.dragFinished(false)) */.on("keyup", (e) => {
                    if(e.which == 13)
                        this.dragFinished(true);
                }));
                if(this.getLevel() == MapLevel.TypeNameWithNoOutlines)
                    $(this.svg_element).addClass("hide-country-borders");
            } else {
                this.$footer.hide();
                const dropDown = $("<div></div>").addClass("dropdown");
                const button = $("<button></button>").addClass("btn btn-secondary dropdown-toggle").text(`Choose a ${this.getSingularNounForMode()}`).attr("data-toggle", "dropdown");
                dropDown.append(button);
                const menu = $("<div></div>").addClass("dropdown-menu h-auto").css({
                    "overflow-x": "hidden",
                    "max-height": "50vh"
                });
                GameTools.assertProperty(globalThis, "_").sortBy(this.countryIds.map((id) => {
                    const obj = { oldId: id, newName: this.getCountryName(id.substr(1).replace(/-/g, ' ')) };
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