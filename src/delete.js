/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module typing/delete
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import DeleteCommand from './deletecommand';
import DeleteObserver from './deleteobserver';
import env from '@ckeditor/ckeditor5-utils/src/env';

/**
 * The delete and backspace feature. Handles the <kbd>Delete</kbd> and <kbd>Backspace</kbd> keys in the editor.
 *
 * @extends module:core/plugin~Plugin
 */
export default class Delete extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'Delete';
	}

	init() {
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;

		view.addObserver( DeleteObserver );

		editor.commands.add( 'forwardDelete', new DeleteCommand( editor, 'forward' ) );
		editor.commands.add( 'delete', new DeleteCommand( editor, 'backward' ) );

		this.listenTo( viewDocument, 'delete', ( evt, data ) => {
			const deleteCommandParams = { unit: data.unit, sequence: data.sequence };

			// If a specific (view) selection to remove was set, convert it to a model selection and set as a parameter for `DeleteCommand`.
			if ( data.selectionToRemove ) {
				const modelSelection = editor.model.createSelection();
				const ranges = [];

				for ( const viewRange of data.selectionToRemove.getRanges() ) {
					ranges.push( editor.editing.mapper.toModelRange( viewRange ) );
				}

				modelSelection.setTo( ranges );

				deleteCommandParams.selection = modelSelection;
			}

			editor.execute( data.direction == 'forward' ? 'forwardDelete' : 'delete', deleteCommandParams );

			data.preventDefault();

			view.scrollToTheSelection();
		} );

		// Android IMEs have a quirk - they change DOM selection after the input changes were performed by the browser.
		// This happens on `keyup` event. Android doesn't know anything about our deletion and selection handling. Even if the selection
		// was changed during input events, IME remembers the position where the selection "should" be placed and moves it there.
		//
		// To prevent incorrect selection, we save the selection after deleting here and then re-set it on `keyup`. This has to be done
		// on DOM selection level, because on `keyup` the model selection is still the same as it was just after deletion, so it
		// wouldn't be changed and the fix would do nothing.
		//
		if ( env.isAndroid ) {
			let domSelectionAfterDeletion = null;

			this.listenTo( viewDocument, 'delete', ( evt, data ) => {
				const domSelection = data.domTarget.ownerDocument.defaultView.getSelection();

				domSelectionAfterDeletion = {
					anchorNode: domSelection.anchorNode,
					anchorOffset: domSelection.anchorOffset,
					focusNode: domSelection.focusNode,
					focusOffset: domSelection.focusOffset
				};
			}, { priority: 'lowest' } );

			this.listenTo( viewDocument, 'keyup', ( evt, data ) => {
				const domSelection = data.domTarget.ownerDocument.defaultView.getSelection();

				domSelection.collapse( domSelectionAfterDeletion.anchorNode, domSelectionAfterDeletion.anchorOffset );
				domSelection.extend( domSelectionAfterDeletion.focusNode, domSelectionAfterDeletion.focusOffset );

				domSelectionAfterDeletion = null;
			} );
		}
	}
}
