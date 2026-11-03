
import {P} from "./globals";
import {movePlanes} from "./procedures/move_planes";
import {combat} from "./procedures/combat";
import {movedIntoFirelane, returnFire} from "./procedures/moved_into_firelane";
import {antiAircraft, placeAaGuns} from "./procedures/aa_guns";
import {placePlanes} from "./procedures/place_planes";
import {returnPlanes} from "./procedures/return_planes";
import {endingGame} from "./game/victory";

export * from "./lifecycle";

P.place_aa_guns = endingGame(placeAaGuns);
P.place_planes = endingGame(placePlanes);
P.return_planes = endingGame(returnPlanes);
P.move_planes = endingGame(movePlanes);
P.anti_aircraft = endingGame(antiAircraft);
P.combat = endingGame(combat);
P.moved_into_firelane = endingGame(movedIntoFirelane);
P.return_fire = endingGame(returnFire);
