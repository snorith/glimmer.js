import Component from '@norith/glimmer-component';
import { tracked } from '@norith/glimmer-tracking';
import { precompileTemplate, setComponentTemplate } from '@norith/glimmer-core';
import { on, action } from '@norith/glimmer-modifier';
import RehydratableRegion from './RehydratableRegion';

class RehydratableCounter extends Component {
  @tracked count = 1;

  @action increment(): void {
    this.count++;
  }
}

setComponentTemplate(
  precompileTemplate(
    `<RehydratableRegion @name="RehydratableCounter" @data={{this.args}}>
      <h1>{{@message}}</h1>
      <p>{{@foo.bar}}</p>
      <p>You have clicked the button {{this.count}} times.</p>
      <button {{on "click" this.increment}}>Click</button>
     </RehydratableRegion>
    `,
    { strictMode: true, scope: { on, RehydratableRegion } }
  ),
  RehydratableCounter
);

export default RehydratableCounter;
