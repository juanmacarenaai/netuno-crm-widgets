import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MensajeError } from '@/ui';

interface Estado {
  error: Error | null;
}

/** Si un módulo falla al dibujarse, muestra un mensaje en lugar de dejar el widget en blanco. */
export class LimiteError extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en el módulo:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <MensajeError
          titulo="Algo salió mal en este widget"
          mensaje={`${this.state.error.message} Si se repite, recarga la página o avisa al equipo.`}
          onReintentar={() => this.setState({ error: null })}
          pantallaCompleta
        />
      );
    }
    return this.props.children;
  }
}
