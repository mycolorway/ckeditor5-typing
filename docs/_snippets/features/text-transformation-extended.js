/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals ClassicEditor, console, window, document */

import { CS_CONFIG } from '@ckeditor/ckeditor5-cloud-services/tests/_utils/cloud-services-config';

ClassicEditor
	.create( document.querySelector( '#snippet-text-transformation-extended' ), {
		cloudServices: CS_CONFIG,
		toolbar: {
			viewportTopOffset: window.getViewportTopOffsetConfig()
		},
		typing: {
			transformations: {
				remove: [
					// Don't use the transformations from the
					// 'symbols' and 'quotes' groups.
					'symbols',
					'quotes',

					// As well as the following transformations.
					'arrowLeft',
					'arrowRight'
				],

				extra: [
					// Add some custom transformations – e.g. for emojis.
					{ from: ':)', to: '🙂' },
					{ from: ':+1:', to: '👍' },
					{ from: ':tada:', to: '🎉' },

					// You can also define patterns using regexp.
					// Note: the pattern must end with `$` and all its fragments must be wrapped
					// with capturing groups.
					// The following rule replaces ` "foo"` with ` «foo»`.
					{
						from: /(^|\s)(")([^"]*)(")$/,
						to: [ null, '«', null, '»' ]
					},

					// Finally, you can define `to` as a callback.
					// This (naive) rule will auto-capitalize first word after a period.
					{
						from: /(\. )([a-z])$/,
						to: matches => [ null, matches[ 1 ].toUpperCase() ]
					}
				],
			}
		}
	} )
	.then( editor => {
		window.editor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );
