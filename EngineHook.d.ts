import { Engine } from '@babylonjs/core';
import { Nullable } from '@babylonjs/core/types';
import { Engine } from '@babylonjs/core/Engines/engine';
import { ReactNativeEngine } from '@babylonjs/react-native';

declare function useEngine(): Engine | undefined;
type EngineProps = { engine?: Engine };

declare type WithEngineProps = {
	abortController: Nullable<AbortController>,
	engine: Nullable<Engine>
};

declare function withEngine<P extends WithEngineProps>(
	Component: React.ComponentType<P>
): React.ComponentType<Omit<P, keyof WithEngineProps>>;

declare class EngineWrapper extends React.Component<WithEngineProps> {
	constructor(props: WithEngineProps);
	async componentDidMount(): Promise<void>;
	componentWillUnmount(): void;
	render(): JSX.Element;
}

export { EngineWrapper, useEngine, withEngine, WithEngineProps };
