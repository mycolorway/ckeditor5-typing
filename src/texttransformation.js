/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module typing/texttransformation
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import TextWatcher from './textwatcher';
import { escapeRegExp } from 'lodash-es';

// All named transformations.
const TRANSFORMATIONS = {
	// Common symbols:
	copyright: { from: '(c)', to: '©' },
	registeredTrademark: { from: '(r)', to: '®' },
	trademark: { from: '(tm)', to: '™' },

	// Mathematical:
	oneHalf: { from: '1/2', to: '½' },
	oneThird: { from: '1/3', to: '⅓' },
	twoThirds: { from: '2/3', to: '⅔' },
	oneForth: { from: '1/4', to: '¼' },
	threeQuarters: { from: '3/4', to: '¾' },
	lessThanOrEqual: { from: '<=', to: '≤' },
	greaterThanOrEqual: { from: '>=', to: '≥' },
	notEqual: { from: '!=', to: '≠' },
	arrowLeft: { from: '<-', to: '←' },
	arrowRight: { from: '->', to: '→' },

	// Typography:
	horizontalEllipsis: { from: '...', to: '…' },
	enDash: { from: /(^| )(--)( )$/, to: [ null, '–', null ] },
	emDash: { from: /(^| )(---)( )$/, to: [ null, '—', null ] },
	// Quotations:
	// English, US
	quotesPrimary: { from: buildQuotesRegExp( '"' ), to: [ null, '“', null, '”' ] },
	quotesSecondary: { from: buildQuotesRegExp( '\'' ), to: [ null, '‘', null, '’' ] },

	// English, UK
	quotesPrimaryEnGb: { from: buildQuotesRegExp( '\'' ), to: [ null, '‘', null, '’' ] },
	quotesSecondaryEnGb: { from: buildQuotesRegExp( '"' ), to: [ null, '“', null, '”' ] },

	// Polish
	quotesPrimaryPl: { from: buildQuotesRegExp( '"' ), to: [ null, '„', null, '”' ] },
	quotesSecondaryPl: { from: buildQuotesRegExp( '\'' ), to: [ null, '‚', null, '’' ] }
};

// Transformation groups.
const TRANSFORMATION_GROUPS = {
	symbols: [ 'copyright', 'registeredTrademark', 'trademark' ],
	mathematical: [
		'oneHalf', 'oneThird', 'twoThirds', 'oneForth', 'threeQuarters',
		'lessThanOrEqual', 'greaterThanOrEqual', 'notEqual',
		'arrowLeft', 'arrowRight'
	],
	typography: [ 'horizontalEllipsis', 'enDash', 'emDash' ],
	quotes: [ 'quotesPrimary', 'quotesSecondary' ]
};

// Set of default transformations provided by the feature.
const DEFAULT_TRANSFORMATIONS = [
	'symbols',
	'mathematical',
	'typography',
	'quotes'
];

/**
 * The text transformation plugin.
 *
 * @extends module:core/plugin~Plugin
 */
export default class TextTransformation extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'TextTransformation';
	}

	/**
	 * @inheritDoc
	 */
	constructor( editor ) {
		super( editor );

		editor.config.define( 'typing', {
			transformations: {
				include: DEFAULT_TRANSFORMATIONS
			}
		} );
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const model = editor.model;
		const input = editor.plugins.get( 'Input' );

		const configuredTransformations = getConfiguredTransformations( editor.config.get( 'typing.transformations' ) );

		for ( const transformation of configuredTransformations ) {
			const from = normalizeFrom( transformation.from );
			const to = normalizeTo( transformation.to );

			const watcher = new TextWatcher( editor.model, text => from.test( text ) );

			watcher.on( 'matched:data', ( evt, data ) => {
				if ( !input.isInput( data.batch ) ) {
					return;
				}

				const matches = from.exec( data.text );
				const replaces = to( matches.slice( 1 ) );

				// Used `focus` to be in line with `TextWatcher#_getText()`.
				const selectionParent = editor.model.document.selection.focus.parent;

				let changeIndex = matches.index;

				model.enqueueChange( writer => {
					for ( let i = 1; i < matches.length; i++ ) {
						const match = matches[ i ];
						const replaceWith = replaces[ i - 1 ];

						if ( replaceWith == null ) {
							changeIndex += match.length;

							continue;
						}

						const replacePosition = model.createPositionAt( selectionParent, changeIndex );
						const replaceRange = model.createRange( replacePosition, replacePosition.getShiftedBy( match.length ) );
						const attributes = getTextAttributesAfterPosition( replacePosition );

						model.insertContent( writer.createText( replaceWith, attributes ), replaceRange );

						changeIndex += replaceWith.length;
					}
				} );
			} );
		}
	}
}

// Normalizes config `from` parameter value.
// The normalized value for `from` parameter is a RegExp instance. If passed `from` is already a RegExp instance it is returned unchanged.
//
// @param {String|RegExp} from
// @returns {RegExp}
function normalizeFrom( from ) {
	if ( typeof from == 'string' ) {
		return new RegExp( `(${ escapeRegExp( from ) })$` );
	}

	// `from` is already a regular expression.
	return from;
}

// Normalizes config `to` parameter value.
// The normalized value for `to` parameter is a function that takes an array and returns an array. See more in configuration description.
// If passed `to` is already a function it is returned unchanged.
//
// @param {String|Array.<null|String>|Function} to
// @returns {Function}
function normalizeTo( to ) {
	if ( typeof to == 'string' ) {
		return () => [ to ];
	} else if ( to instanceof Array ) {
		return () => to;
	}

	// `to` is already a function.
	return to;
}

// For given `position` returns attributes for the text that is after that position.
// The text can be in the same text node as the position (`foo[]bar`) or in the next text node (`foo[]<$text bold="true">bar</$text>`).
//
// @param {module:engine/model/position~Position} position
// @returns {Iterable.<*>}
function getTextAttributesAfterPosition( position ) {
	const textNode = position.textNode ? position.textNode : position.nodeAfter;

	return textNode.getAttributes();
}

// Returns a RegExp pattern string that detects a sentence inside a quote.
//
// @param {String} quoteCharacter The character to create a pattern for.
// @returns {String}
function buildQuotesRegExp( quoteCharacter ) {
	return new RegExp( `(^|\\s)(${ quoteCharacter })([^${ quoteCharacter }]*)(${ quoteCharacter })$` );
}

// Reads text transformation config and returns normalized array of transformations objects.
//
// @param {module:typing/texttransformation~TextTransformationDescription} config
// @returns {Array.<module:typing/texttransformation~TextTransformationDescription>}
function getConfiguredTransformations( config ) {
	const extra = config.extra || [];
	const remove = config.remove || [];
	const isNotRemoved = transformation => !remove.includes( transformation );

	const configured = config.include.concat( extra ).filter( isNotRemoved );

	return expandGroupsAndRemoveDuplicates( configured )
		.filter( isNotRemoved ) // Filter out 'remove' transformations as they might be set in group
		.map( transformation => TRANSFORMATIONS[ transformation ] || transformation );
}

// Reads definitions and expands named groups if needed to transformation names.
// This method also removes duplicated named transformations if any.
//
// @param {Array.<String|Object>} definitions
// @returns {Array.<String|Object>}
function expandGroupsAndRemoveDuplicates( definitions ) {
	// Set is using to make sure that transformation names are not duplicated.
	const definedTransformations = new Set();

	for ( const transformationOrGroup of definitions ) {
		if ( TRANSFORMATION_GROUPS[ transformationOrGroup ] ) {
			for ( const transformation of TRANSFORMATION_GROUPS[ transformationOrGroup ] ) {
				definedTransformations.add( transformation );
			}
		} else {
			definedTransformations.add( transformationOrGroup );
		}
	}

	return Array.from( definedTransformations );
}

/**
 * Text transformation definition object. Describes what should be replaced with what.
 *
 * The input value (`from`) can be passed either as a string or a regexp.
 *
 * * If a string is passed it will be simply checked if the end of the input matches it.
 * * If a regexp is passed, its entire length must be covered with capturing groups (e.g. `/(foo)(bar)$/`).
 * Also, since it is compared against the end of the input, it has to end with  `$` to be correctly matched.
 * See examples below.
 *
 * The output value (`to`) can be passed either as a string or an array or a function.
 *
 * * If a string is passed, it will be used as a replacement value as-is. Note, that a string output value can be used only if
 * the input value is a string too.
 * * If an array is passed it has to have the same number of elements as there are capturing groups in the input value regexp.
 * Each capture group will be replaced by a corresponding string from the passed array. If given capturing group should not be replaced,
 * use `null` instead of passing a string.
 * * If a function is used, it should return an array as described above. The function is passed one parameter &mdash; an array with matches
 * by the regexp. See the examples below.
 *
 * Simple string-to-string replacement:
 *
 *		{ from: '(c)', to: '©' }
 *
 * Change quotes styles using regular expression. Note how all the parts are in separate capturing groups and the space at the beginning and
 * the text inside quotes are not replaced (`null` passed as the first and the third value in `to` parameter):
 *
 *		{
 *			from: /(^|\s)(")([^"]*)(")$/,
 *			to: [ null, '“', null, '”' ]
 *		}
 *
 * Automatic uppercase after a dot using a callback:
 *
 *		{
 *			from: /(\. )([a-z])$/,
 *			to: matches => [ null, matches[ 1 ].toUpperCase() ]
 *		}
 *
 * @typedef {Object} module:typing/texttransformation~TextTransformationDescription
 * @property {String|RegExp} from The string or RegExp to transform.
 * @property {String} to The text to transform compatible with `String.replace()`
 */

/**
 * The configuration of the {@link module:typing/texttransformation~TextTransformation} feature.
 *
 * Read more in {@link module:typing/texttransformation~TextTransformationConfig}.
 *
 * @member {module:typing/texttransformation~TextTransformationConfig} module:typing/typing~TypingConfig#transformations
 */

/**
 * The configuration of the text transformation feature.
 *
 *		ClassicEditor
 *			.create( editorElement, {
 *				typing: {
 *					transformations: ... // Text transformation feature options.
 *				}
 *			} )
 *			.then( ... )
 *			.catch( ... );
 *
 * By default, the feature comes pre-configured
 * (via {@link module:typing/texttransformation~TextTransformationConfig#include `config.typing.transformations.include`}) with the
 * following groups of transformations:
 *
 * * Typography (group name: `typography`)
 *   - `ellipsis`: transforms `...` to `…`
 *   - `enDash`: transforms ` -- ` to ` – `
 *   - `emDash`: transforms ` --- ` to ` — `
 * * Quotations (group name: `quotes`)
 *   - `quotesPrimary`: transforms `"Foo bar"` to `“Foo bar”`
 *   - `quotesSecondary`: transforms `'Foo bar'` to `‘Foo bar’`
 * * Symbols (group name: `symbols`)
 *   - `trademark`: transforms `(tm)` to `™`
 *   - `registeredTrademark`: transforms `(r)` to `®`
 *   - `copyright`: transforms `(c)` to `©`
 * * Mathematical (group name: `mathematical`)
 *   - `oneHalf`: transforms `1/2`, to: `½`
 *   - `oneThird`: transforms `1/3`, to: `⅓`
 *   - `twoThirds`: transforms `2/3`, to: `⅔`
 *   - `oneForth`: transforms `1/4`, to: `¼`
 *   - `threeQuarters`: transforms `3/4`, to: `¾`
 *   - `lessThanOrEqual`: transforms `<=`, to: `≤`
 *   - `greaterThanOrEqual`: transforms `>=`, to: `≥`
 *   - `notEqual`: transforms `!=`, to: `≠`
 *   - `arrowLeft`: transforms `<-`, to: `←`
 *   - `arrowRight`: transforms `->`, to: `→`
 * * Misc:
 *   - `quotesPrimaryEnGb`: transforms `'Foo bar'` to `‘Foo bar’`
 *   - `quotesSecondaryEnGb`: transforms `"Foo bar"` to `“Foo bar”`
 *   - `quotesPrimaryPl`: transforms `"Foo bar"` to `„Foo bar”`
 *   - `quotesSecondaryPl`:  transforms `'Foo bar'` to `‚Foo bar’`
 *
 * In order to load additional transformations, use the
 * {@link module:typing/texttransformation~TextTransformationConfig#extra `transformations.extra` option}.
 *
 * In order to narrow down the list of transformations, use the
 * {@link module:typing/texttransformation~TextTransformationConfig#remove `transformations.remove` option}.
 *
 * In order to completely override the supported transformations, use the
 * {@link module:typing/texttransformation~TextTransformationConfig#include `transformations.include` option}.
 *
 * Examples:
 *
 *		const transformationsConfig = {
 *			include: [
 *				// Use only the 'quotes' and 'typography' groups.
 *				'quotes',
 *				'typography',
 *
 *				// Plus, some custom transformation.
 *				{ from: 'CKE', to: 'CKEditor' }
 *			]
 *		};
 *
 *		const transformationsConfig = {
 *			// Remove the 'ellipsis' transformation loaded by the 'typography' group.
 *			remove: [ 'ellipsis' ]
 *		}
 *
 * @interface TextTransformationConfig
 */

/* eslint-disable max-len */
/**
 * The standard list of text transformations supported by the editor. By default it comes pre-configured with a couple dozen of them
 * (see {@link module:typing/texttransformation~TextTransformationConfig} for the full list of them). You can override this list completely
 * by setting this option or use the other two options
 * ({@link module:typing/texttransformation~TextTransformationConfig#extra `transformations.extra`},
 * {@link module:typing/texttransformation~TextTransformationConfig#remove `transformations.remove`}) to fine tune the default list.
 *
 * @member {Array.<module:typing/texttransformation~TextTransformationDescription>} module:typing/texttransformation~TextTransformationConfig#include
 */

/**
 * The extra text transformations that are added to the transformations defined in
 * {@link module:typing/texttransformation~TextTransformationConfig#include `transformations.include`}.
 *
 *		const transformationsConfig = {
 *			extra: [
 *				{ from: 'CKE', to: 'CKEditor' }
 *			]
 *		};
 *
 * @member {Array.<module:typing/texttransformation~TextTransformationDescription>} module:typing/texttransformation~TextTransformationConfig#extra
 */

/**
 * The text transformations names that are removed from transformations defined in
 * {@link module:typing/texttransformation~TextTransformationConfig#include `transformations.include`} or
 * {@link module:typing/texttransformation~TextTransformationConfig#extra `transformations.extra`}.
 *
 *		const transformationsConfig = {
 *			remove: [
 *				'ellipsis',    // Remove only 'ellipsis' from 'typography' group.
 *				'mathematical' // Remove all transformations from 'mathematical' group.
 *			]
 *		}
 *
 * @member {Array.<module:typing/texttransformation~TextTransformationDescription>} module:typing/texttransformation~TextTransformationConfig#remove
 */
/* eslint-enable max-len */
