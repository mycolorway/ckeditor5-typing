/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import ModelTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import { setData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import TextWatcher from '../src/textwatcher';

describe( 'TextWatcher', () => {
	let editor, model, doc;
	let watcher, matchedDataSpy, matchedSelectionSpy, unmatchedSpy, testCallbackStub;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		return ModelTestEditor.create()
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				doc = model.document;

				testCallbackStub = sinon.stub();
				matchedDataSpy = sinon.spy();
				matchedSelectionSpy = sinon.spy();
				unmatchedSpy = sinon.spy();

				model.schema.register( 'paragraph', { inheritAllFrom: '$block' } );

				setData( model, '<paragraph>foo []</paragraph>' );

				watcher = new TextWatcher( model, testCallbackStub, () => {} );
				watcher.on( 'matched:data', matchedDataSpy );
				watcher.on( 'matched:selection', matchedSelectionSpy );
				watcher.on( 'unmatched', unmatchedSpy );
			} );
	} );

	afterEach( () => {
		sinon.restore();

		if ( editor ) {
			return editor.destroy();
		}
	} );

	describe( 'testCallback', () => {
		it( 'should evaluate text before caret for data changes', () => {
			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledWithExactly( testCallbackStub, 'foo @' );
		} );

		it( 'should not evaluate text for not collapsed selection', () => {
			model.change( writer => {
				const start = writer.createPositionAt( doc.getRoot().getChild( 0 ), 0 );

				writer.setSelection( writer.createRange( start, start.getShiftedBy( 1 ) ) );
			} );

			sinon.assert.notCalled( testCallbackStub );
		} );

		it( 'should evaluate text for selection changes', () => {
			model.change( writer => {
				writer.setSelection( doc.getRoot().getChild( 0 ), 1 );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledWithExactly( testCallbackStub, 'f' );
		} );

		it( 'should evaluate text before caret up to <softBreak>', () => {
			model.schema.register( 'softBreak', {
				allowWhere: '$text',
				isInline: true
			} );

			model.change( writer => {
				writer.insertElement( 'softBreak', doc.selection.getFirstPosition() );
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledWithExactly( testCallbackStub, '@' );
		} );

		it( 'should not evaluate text for transparent batches', () => {
			model.enqueueChange( 'transparent', writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.notCalled( testCallbackStub );
		} );
	} );

	describe( 'events', () => {
		it( 'should fire "matched:data" event when test callback returns true for model data changes', () => {
			testCallbackStub.returns( true );

			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledOnce( matchedDataSpy );
			sinon.assert.notCalled( matchedSelectionSpy );
			sinon.assert.notCalled( unmatchedSpy );
		} );

		it( 'should fire "matched:selection" event when test callback returns true for model data changes', () => {
			testCallbackStub.returns( true );

			model.enqueueChange( 'transparent', writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			model.change( writer => {
				writer.setSelection( doc.getRoot().getChild( 0 ), 0 );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.notCalled( matchedDataSpy );
			sinon.assert.calledOnce( matchedSelectionSpy );
			sinon.assert.notCalled( unmatchedSpy );
		} );

		it( 'should not fire "matched" event when test callback returns false', () => {
			testCallbackStub.returns( false );

			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.notCalled( matchedDataSpy );
			sinon.assert.notCalled( matchedSelectionSpy );
			sinon.assert.notCalled( unmatchedSpy );
		} );

		it( 'should fire "unmatched" event when test callback returns false when it was previously matched', () => {
			testCallbackStub.returns( true );

			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledOnce( matchedDataSpy );
			sinon.assert.notCalled( unmatchedSpy );

			testCallbackStub.returns( false );

			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledTwice( testCallbackStub );
			sinon.assert.calledOnce( matchedDataSpy );
			sinon.assert.calledOnce( unmatchedSpy );
		} );

		it( 'should fire "umatched" event when selection is expanded', () => {
			testCallbackStub.returns( true );

			model.change( writer => {
				writer.insertText( '@', doc.selection.getFirstPosition() );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledOnce( matchedDataSpy );
			sinon.assert.notCalled( matchedSelectionSpy );
			sinon.assert.notCalled( unmatchedSpy );

			model.change( writer => {
				const start = writer.createPositionAt( doc.getRoot().getChild( 0 ), 0 );

				writer.setSelection( writer.createRange( start, start.getShiftedBy( 1 ) ) );
			} );

			sinon.assert.calledOnce( testCallbackStub );
			sinon.assert.calledOnce( matchedDataSpy );
			sinon.assert.notCalled( matchedSelectionSpy );
			sinon.assert.calledOnce( unmatchedSpy );
		} );
	} );
} );

