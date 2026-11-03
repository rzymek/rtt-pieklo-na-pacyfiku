import {onInit} from "./on_init";
import {onUpdate} from "./on_update";

on_init = onInit;
on_update = onUpdate;

add_main_menu_item_link("Rules", "/pieklo-na-pacyfiku/info/rules.pdf");

add_icon_button(1, "pieces_button", "earth-africa-europe", () => document.body.classList.toggle("hide-pieces"));
