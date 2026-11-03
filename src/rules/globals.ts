import {data} from "./game/data.js"
import type {FrameState, StateDefinition} from "@rzymek/rally-the-troops-module/rules"
import type {View} from "../shared/view"
import {ROLE_NAMES} from "../shared/shared"
import type {GameState} from "./types.js"

/** G - the (global) game state

 This object contains the full representation of the game. There are several properties here that are special!

 ```
 G.L      // local scope (aliased as L below)
 G.seed		// random number generator state
 G.log		// game log text
 G.undo		// undo stack
 G.active	// currently active role (or roles)
 ```
 Add to G any data you need to represent the game board state.

 The G.L, G.seed, G.log, and G.undo properties are automatically managed; you should never need to touch these.

 The G.active is used to indicate whose turn it is to take an action. It can be set to a single role index, or an array of multiple roles.

 ```
 G.active = R_WHITE
 G.active = [ R_WHITE, R_BLACK ]
 </code>
 ```
 */

export let G: GameState
/** L - the (local) game state

 There is a local scope for storing data that is only used by a particular state.
 This local scope has reserved properties ("P", "I", and "L") that you must not touch!
 These properties are used to track the execution of scripts and where to go next.
 */
export let L: FrameState
/** R - who are you?

 Whenever the system executes code to handle user actions or populate the user view object,
 the R global is set to the index of the corresponding user.
 You should rarely need to use this outside of on_view,
 but when multiple users are active simultaneously,
 use R to distinguish between them in the action handlers. */
export let R!: number
/** V - the view object

 The view object that is being generated for the client is held in V during the execution of the on_view hook and the state prompt functions (see below).
 */
export let V: View

/** States and procedures */
export const P: Record<string, StateDefinition | string | Array<() => void>> = {}

// framework.js links to these by name: they have to stay declared at the top level of this bundle.
export const ROLES = [...ROLE_NAMES]
export const R_Amer = 0
export const R_Jap = 1
export const sides = [R_Amer, R_Jap];
export const planes = data.planes
