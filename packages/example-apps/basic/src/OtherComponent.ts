import Component from '@norith/glimmer-component';
import { precompileTemplate, setComponentTemplate } from '@norith/glimmer-core';

export default class OtherComponent extends Component {}

setComponentTemplate(
  precompileTemplate(`<b>Counter Val: {{@count}}</b>`, { strictMode: true }),
  OtherComponent
);
