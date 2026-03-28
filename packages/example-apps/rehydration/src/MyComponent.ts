import Component from '@norith/glimmer-component';
import { tracked } from '@norith/glimmer-tracking';
import { precompileTemplate, setComponentTemplate } from '@norith/glimmer-core';
import { on, action } from '@norith/glimmer-modifier';

class MyComponent extends Component {
  @tracked count = 1;

  @action increment(): void {
    this.count++;
  }
}

setComponentTemplate(
  precompileTemplate(
    `<p>You have clicked the button {{this.count}} times.</p>
     <button {{on "click" this.increment}}>Click</button>
    `,
    { strictMode: true, scope: { on } }
  ),
  MyComponent
);

export default MyComponent;
