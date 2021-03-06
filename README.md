<img src="https://raw.githubusercontent.com/stephenwf/iiif-redux/master/iiif-redux.png" width="510" />

[![Coverage Status](https://coveralls.io/repos/github/stephenwf/iiif-redux/badge.svg)](https://coveralls.io/github/stephenwf/iiif-redux)
[![Build Status](https://travis-ci.org/stephenwf/iiif-redux.svg?branch=master)](https://travis-ci.org/stephenwf/iiif-redux)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fstephenwf%2Fiiif-redux.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fstephenwf%2Fiiif-redux?ref=badge_shield)

___

:warning: IIIF Redux current state is a request for comments from the community with a proposal for managing 
IIIF resources state on the frontend for both presentational and content creation purposes.

**Pull requests + issues are welcomed to discuss and improve this proposal.** 

___

## Concepts

There are a few concept used in this proposal for IIIF Redux to format, organise, mutate and access data from IIIF resources.

### Normalisation of data structures
IIIF and JSON-LD in general is built on the concept of resource types and the relations between them. 
In IIIF we have the basic types:

<details>
  <summary>we have the basic types</summary>
  <img src="http://iiif.io/api/presentation/2.1/img/objects.png" width="200" />
</details>


<details>
  <summary>and the additional types</summary>
  <img src="http://iiif.io/api/presentation/2.1/img/objects-all.png" width="300"/>
</details>

Each of these types are deeply nested and interconnected. In JSON-LD you can specify as much or as little information
about a resource:
```json
{
  "@id": "http://foobar.com/test.json",
  "@type": "foo"
}
```
or
```json
{
  "@context": {"dc": "http://purl.org/dc/elements/1.1/"},
  "@id": "http://foobar.com/test.json",
  "@type": "foo",
  "dc:title": "Some title field",
  "dc:description": "Some description"
}
```
They are the same resource, and sometimes when a field is referenced, we want to be able to show those extra fields. 
In IIIF ranges work much in this way:
```json
{
  "@id": "http://example.org/iiif/book1/range/r1",
  "@type": "sc:Range",
  "label": "Introduction",
  "ranges": ["http://example.org/iiif/book1/range/r1-1"],
  "canvases": [
    "http://example.org/iiif/book1/canvas/p1",
    "http://example.org/iiif/book1/canvas/p2",
    "http://example.org/iiif/book1/canvas/p3#xywh=0,0,750,300"
  ]
}
```

In an application, when you are representing a structure like this you will take the IDs here and look for them elsewhere
in the data structure, in this case in the `manifest.sturctures` and in the `manifest.sequences[0..n].canvases`. So when you 
say I want all the canvas labels for a range, the process may be along the lines of:
* loop through all sequences
* loop through all canvases
* if one matches any of my ids store it
* return the list

This starts to get complicated when dealing with deeply nested structures, dereferenced resources that need to be fetched before 
they are available. For APIs using these resources they tend to re-map the data into maps as a cache, or use promises for some 
calls to wait for the data. This leads to duplicated data and inconsistent APIs.

#### Normalisation step
IIIF Redux will hold a global state, which it wholly owns. Since data may be changing, or being added during the lifecycle of an 
application, we should aim to only store data once. This means one source of truth for resources, and one place to update if you need 
to edit content. The normalisation step breaks a graph-like structure of a IIIF document into the resource types that make it up.

For example, this simplified example of a IIIF Manifest:
```json
{
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@id": "http://example.org/iiif/book1/manifest",
  "@type": "sc:Manifest",
  "sequences": [
    {
      "@id": "http://example.org/iiif/book1/sequence/normal",
      "@type": "sc:Sequence",
      "label": "Current Page Order",
      "canvases": [
        {
          "@id": "http://example.org/iiif/book1/canvas/p1",
          "@type": "sc:Canvas",
          "label": "p. 1"
        },
        {
          "@id": "http://example.org/iiif/book1/canvas/p2",
          "@type": "sc:Canvas",
          "label": "p. 2"
        }
      ]
    }
  ]
}
```

Would be stored as:
```json
{
  "manifests": {
    "http://example.org/iiif/book1/manifest": {
      "@context": "http://iiif.io/api/presentation/2/context.json",
      "@id": "http://example.org/iiif/book1/manifest",
      "@type": "sc:Manifest",
      "sequences": [
        "http://example.org/iiif/book1/sequence/normal"
      ]
    }
  },
  "sequences": {
    "http://example.org/iiif/book1/sequence/normal": {
      "@id": "http://example.org/iiif/book1/sequence/normal",
      "@type": "sc:Sequence",
      "label": "Current Page Order",
      "canvases": [
        "http://example.org/iiif/book1/canvas/p1",
        "http://example.org/iiif/book1/canvas/p2"
      ]
    }
  },
  "canvases": {
    "http://example.org/iiif/book1/canvas/p1": {
      "@id": "http://example.org/iiif/book1/canvas/p1",
      "@type": "sc:Canvas",
      "label": "p. 1"
    },
    "http://example.org/iiif/book1/canvas/p2": {
      "@id": "http://example.org/iiif/book1/canvas/p2",
      "@type": "sc:Canvas",
      "label": "p. 2"
    }
  }
}
```

This way of storing manifests has a few key benefits:
* **scalable** you can store as many manifests as you need in this data structure without caring about cross-talk
* **quick to read** reading data from this structure is very easy
  * Getting the `nth` canvas on a manifest `sequence.canvases[n]`
  * Finding out what the index of a canvas is `sequence.canvases.indexOf(id)`
  * Getting canvas by ID: `canvases[id]` 
* **quick to write** writing data can be tricky, but with ID maps for every item, this becomes trivial
  * Setting a label `canvas[id].label = 'something else'` 
  * Resources can be created without being referenced anywhere, great for authoring tools + drafting workflows 

A few of the downsides too though:
* Getting deeply nested data can be difficult:
  * Label of first canvas on a manifest 
```js
const firstSequence = state.manifest.sequences[0];
const firstCanvas = state.sequences[firstSequence].canvases[0];
const firstCanvasLabel = state.canvases[firstCanvas].label;
```
* Iterating over all resources
  * If you loaded 100 manifests, but not from a collection, you wouldn't have an array of IDs to iterate, only a map (slow)
 
To combat the first issue, we need a complete API for reading data from our store, to make it as accessible for applications.

#### Presentation 2 vs Presentation 3 (and beyond)
I think a good rule of thumb for a new library would be to build to the most recent ratified specification. Currently this is
Presentation 2, but later this year it is expected to be Presentation 3. The way this library should work is to store data
that conforms to the latest Presentation specification, and convert on the way in.

If it is required that we export the state to a previous version of the presentation specification, that should be an external
library or add-on that can process the state into that format. Effectively this library will double as a Presentation 2 to 3 
converter once the spec is ratified.

Other external tooling possibilities:
* IIIF Validation across the state
* Manifest / Canvas Authoring tools
* External metadata comprehension, tooling + display
* External annotation comprehension, tooling + display (and authoring)

### Value normalization
At the moment its unclear what the best approach for normalizing values, such as internationalised string should be.
One option would be to normalize the data before we add it to the store. So for example:
```json
{
  "@id": "...",
  "label": "some label",
  "description": "some description"
}
```
would be stored in state as:
```json
{
  "@id": "...",
  "label": [{ "@language": "@none", "@value": "some label" }],
  "description": [{ "@language": "@none", "@value": "some description" }]
}
```
Similarly, for fields that can be Objects or arrays of objects, normalizing those into always be arrays.

The downsides to this approach would be the lossy nature of this, there's no way of knowing what the original manifest looked like. 
In addition, it would make editing existing manifests harder as this set of rules for normalizing would be reflected in the output.

The second option is to normalize on the way out, in the selectors themselves. Structurally this adds some overhead in the API, but
the benefits (opposite of those mentioned above) seem to be worth it.

#### Exceptions to the rule
Some things need to be normalized on the way in, in a sort of expand for the state, and contract for the output. One example is 
when annotations target a specific region of a selector, this should be expanded out to make it easier to associate IDs in the 
original normalization step. 

### Selectors
The very basics of a selector is a simple function that takes a big object, and returns a smaller object or a single value.
```js
function getCurrentManifest(state) {
  return state.currentManifest;
}

function getLabel(manifest) {
  return manifest.label;
}
```

They are pure by design so only have access to the parameters you put into them. This allows them to be optimised (see [Memoization](#memoization))

Selectors are usually either small chunks of logic to deal with potential logic of getting from big object to smaller object, which are
then composed into other selectors to create new objects or models.

This library aims to use (Reselect)[https://github.com/reactjs/reselect] to compose selectors. For example, take our label examples above.
```js
const getCurrentManifestLabel = createSelector(
  getCurrentManifest,
  function (manifest) {
    return getLabel(manifest);
  }
);
```
Now we have a selector that we can run our entire state through to get the current manifest label:
```js
const state = {
  currentManifest: 'manifest1',
  manifests: {
    manifest1: {
      label: 'foobar',
    },
  },
};

const label = getCurrentManifestLabel(state); // foobar
```

We can build up a library of these selectors, and since they are simple functions they are easy to test and easy to replace. 
Take for example, the upcoming Presentation 3 changes which changes the structure of the label field to use language maps (simplified example):
```js
const getCurrentManifestLabel = createSelector(
  getCurrentManifest,
  getCurrentLocale,
  function(manifest, locale) {
    const label = getLabel(manifest);
    if (label[locale]) {
      return label[locale][0];
    }
    return label['@none'][0];
  }
);
```

We could go further and split out rationale of international strings too:
```js
const getLocalisedString = function (localeMap) {
  return createSelector(
    getCurrentLocale,
    function (locale) {
      if (localeMap[locale]) {
        return localeMap[locale][0];
      }
      return localeMap['@none'][0];
    }
  );
}
```
So as this language handling is able to handle more logic, configuration etc. its benefits all components, much like creating helpers.

Lastly when you come to use these selectors you can build up a custom data structure from these selectors:
```js
const myModel = createStructuredSelector({
  label: getCurrentManifestLabel,
  description: getCurrentManifestDescription,
  metadata: getCurrentManifestMetadata,
  thumbnails: getThumbnails(4, { width: 200 })
});
```

### Memoization
An important aspect of reselect is how it caches results of the selectors based on the input. [More information](https://github.com/reactjs/reselect#motivation-for-memoized-selectors)

So if we called:
```js
getCurrentManifest(state);
getCurrentManifest(state);
getCurrentManifestLabel(state);
getCurrentManifestDescription(state);
```
Since the state here never changes each of our selectors will only be called once, even though the last two are composed
of the the first one.

For this to work, one of Redux's best practices should be followed: [Immutable state](https://medium.com/@dtinth/immutable-js-persistent-data-structures-and-structural-sharing-6d163fbd73d2)

This ensures that `oldState !== newState` whenever anything changes in the tree. 

## Proposed API
The API that this library is aiming to provide can be split into three parts:
* Redux store + actions
* Selector library
* Manifesto compatibility

### Redux store + actions
The foundation of this library is the redux store and the actions is provides.
```js
import { createStore } from 'iiif-redux';
import { requestManifest, nextCanvas, previousCanvas } from 'iiif-redux/actions';
import { customThumbnails } from 'iiif-redux/api/currentCanvas';

const store = createStore();

store.dispatch(requestManifest('http://.../'));

store.subscribe(function() {
  const state = store.getState();
  const thumbnails = customThumbnails(state);
  
  document.querySelector('#image').innerHTML = `<img src="${thumbnails(200)}" />`
});

document.querySelector('#next').addEventListener(function() {
  store.dispatch(nextCanvas());
});

document.querySelector('#prev').addEventListener(function() {
  store.dispatch(previousCanvas());
});
```

While also allow you to integrate into an existing Redux application, or with your own custom reducers in a new project.
```js
import {applyMiddleware, createStore, combineReducers} from 'redux';
import createSagaMiddleware from 'redux-saga';
import { reducers, middleware, sagas, defaultState } from 'iiif-redux/store'

import * as customReducers from './reducers';
import customSagas from './sagas';

const extraMiddleware = [ /* ... */ ];
const defaultStateCombined = { ...defaultState, myOtherFields: { /* ... */ } };

const sagaMiddleware = createSagaMiddleware();

const store = createStore(
  combineReducers({ ...reducers, ...customReducers }),
  defaultStateCombined,
  applyMiddleware(sagaMiddleware, ...extraMiddleware)
);

sagas.map(saga => sagaMiddleware.run(saga));
customSagas.map(saga => sagaMiddleware.run(saga));

export default store;
```

### Selector library
Currently in Manifesto, the selectors for data and content live on Object (Manifests, Annotations etc.) which you call
from instances. In almost all instances when using Manifesto you will create a single manifest object and pass it down
through your application, calling its various methods to get values to display. Even if you are passing down a subset of
Manifesto, like a Canvas (driven by current canvas in some state) you are still working off that single source of truth.

#### Examples:
```js
// get label from current manifest
import { getLabel } from 'iiif-redux/api/currentManifest';

// get label + thumbnail from current canvas
import { getLabel, getThumbnail } from 'iiif-redux/api/currentCanvas';
```

Possibility of creating your own selectors too:
```js
import { getCanvases } from 'iiif-redux/api/currentManifest';
import { getLabel, getThumbnail } from 'iiif-redux/api/canvas';
import { createSelector, createStructuredSelector } from 'reselect';

const myCustomCanvasSelector = createSelector(
  getCanvases,
  canvases => canvases.map(
    createStructuredSelector({
      thumbnail: getThumbnail(200),
      label: getLabel,
    })
  )
);

myCustomCanvasSelector(state); // [ { label: '..', thumbnail: '..' }, { label: '..', thumbnail: '..' }, ... ]
```
:warning: This might have implications on memoization

### Manifesto Compatibility

I think too its important for community adoption that we also provide a Manifesto compatible API:

```js
import Manifesto from 'iiif-redux/manifesto';

const myManifest = Manifesto.load('http://...').then(
  manifest => Manifesto.create(manifest)
);

myManifest.getDefaultLabel(); // label (ignoring promise!)
```

Which will wrap up the Redux into this API with the same types. If we do this though, I think we should also be aiming for 
a clear and easy upgrade path. So you can start transitioning to Redux from the top down, with deeper components still using 
Manifesto objects, but further up using redux.
```js
import { createStore } from 'iiif-redux';
import { createManifestoWrapper } from 'iiif-redux/manifesto'
import { requestManifest } from 'iiif-redux/actions';
import { getMetadata, loadingStatus } from 'iiif-redux/api/currentManifest';

const store = createStore();

store.dispatch(requestManifest('http://...'));

store.subscribe(function () {
  const $el = doucment.querySelector('#app');
  const state = store.getState();
  const isLoaded = loadingStatus(state) === 'done';
  if (!isLoaded) {
    $el.innerText = 'loading...';
    return;
  }
  // This is a Manifesto.Manifest compatible type.
  const manifest = createManifestoWrapper(state);
  $el.innerText = manifest.getDefaultLabel();
});
```

### Library usage 
But ultimately modeling an API that can power future components using Redux. Typically redux
is used in top-down data driven libraries such as Stencil, VueJS + React.

#### Stencil JS
The future of the Universal Viewer and potentially other Typescript based is WebComponents and Stencil JS offers a
great Typescript path to WebComponents. Much like all component based libraries, I expect these to be split into [Presentational and Container components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
so the following example is simplified but demonstrative. 

```typescript jsx
import { Store, Action } from '@stencil/redux';
import { getLabel, getDescription } from 'iiif-redux/api/currentManifest';
import { createStructuredSelector } from 'reselect';

@Component({
  tag: 'my-description-component',
  styleUrl: 'my-description-component.scss'
})
export class MyDescriptionComponent {
  @Prop({ context: 'store' }) store: Store;
 
  @State() label: string;
  @State() description: string;
  
  componentWillLoad() {
    // Here we bind our state using the selector library.
    this.store.mapStateToProps(this, 
      createStructuredSelector({
        label: getLabel,
        description: getDescription,
      })
    );
  }
  
  render() {
    return (
      <div>
        <h1>{ this.label }</h1>
        <p>{ this.description }</p>
      </div>
    );
  }
}
```

You can read more over at [Stencil Redux](https://github.com/ionic-team/stencil-redux)

#### VueJS
Another common and increasingly popular framework for building web applications is VueJS. 

With VueJS there are 2 main ways to create components. But both work in much the same way.

```js
import { connect } from 'redux-vue';
import { getLabel, getDescription } from 'iiif-redux/api/currentManifest';
import { createStructuredSelector } from 'reselect';

const MyDescriptionComponent = {
  props: {
    title: { type: String },
    description: { type: String },
  },
  
  render(h) {
    return (
      <div>
        <h1>{ this.label }</h1>
        <p>{ this.description }</p>
      </div>
    );
  }
};

// Here we bind our state using the selector library.
export default connect(
  createStructuredSelector({
    label: getLabel,
    description: getDescription,
  })
)(MyDescriptionComponent)
```

But also in single file components, where you have to connect it separately
```html
<template>
  <div>
    <h1>{{ label }}</h1>
    <p>{{ description }}</p>
  </div>
</template>

<script>
export default {
  name: 'my-description-component',
}
</script>

<style>
</style>
```

And then the binding:
```js
import { connect } from 'redux-vue';
import { getLabel, getDescription } from 'iiif-redux/api/currentManifest';
import { createStructuredSelector } from 'reselect';
import MyDescriptionComponent from './my-description-component.vue';

// Here we bind our state using the selector library.
export default connect(
  createStructuredSelector({
    label: getLabel,
    description: getDescription,
  })
)(MyDescriptionComponent)
```

#### React
The more contraversial library, but also covering React-like libraries (Preact, Inferno, Virtual-DOM, Deku) which follow
the same basic model of `props => jsx`.

```js
import  React, { Component } from 'react';
import { connect } from 'react-redux';
import { getLabel, getDescription } from 'iiif-redux/api/currentManifest';
import { createStructuredSelector } from 'reselect';

@connect(
  createStructuredSelector({
    label: getLabel,
    description: getDescription,
  })
)
export default class MyDescriptionComponent {
  render() {
    const { label, description } = this.props;
    return (
      <div>
        <h1>{ label }</h1>
        <p>{ description }</p>
      </div>
    );
  }
} 
```

<details>
  <summary>:warning: this example uses decorators, which is an unstable proposal and likely to change (click to see without)</summary>

```js
import  React, { Component } from 'react';
import { connect } from 'react-redux';
import { getLabel, getDescription } from 'iiif-redux/api/currentManifest';
import { createStructuredSelector } from 'reselect';

class MyDescriptionComponent {
 render() {
   const { label, description } = this.props;
   return (
     <div>
       <h1>{ label }</h1>
       <p>{ description }</p>
     </div>
   );
 }
} 

export default connect(
  createStructuredSelector({
    label: getLabel,
    description: getDescription,
  })
)(MyDescriptionComponent)
```
</details>

## Testing
For libraries that deal with interoperable data its important to have smoke tests that can be run over 
large sets of manifests. These tests would have to be `expect(blah).toExist()` or `expect(blah.length).not.toEqual(0)` type
tests that SHOULD pass for all manifests. 

In addition unit tests of the units that make up the library (selectors, reducers, actions).

Finally running Interoperable Manifesto library through Manifesto's tests too would work to ensure parity.

## Contributing
This project is currently firmly in the planning and prototyping stages at the moment. Any contributions in the
form of pull requests or issues for discussion are welcome.


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fstephenwf%2Fiiif-redux.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fstephenwf%2Fiiif-redux?ref=badge_large)
