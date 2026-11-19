import { Link } from 'react-router';
import gym from '../config/gym.json';

export default function Privacy({ inApp = false }: { inApp?: boolean }) {
  return (
    <section className="max-w-2xl leading-relaxed">
      <Link to={inApp ? '/app' : '/'} className="tap inline-flex items-center text-orange">
        ← Volver a la app
      </Link>
      <h1 className="display mt-4 text-6xl">Protección de datos personales</h1>
      <p className="mt-6">
        En cumplimiento de la Ley N.º 29733, Ley de Protección de Datos Personales, y su Reglamento (D.S. 016-2024-JUS),{' '}
        {gym.nombre} informa:
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-5">
        <li>
          <strong>Datos que tratamos:</strong> nombre, número de celular y, opcionalmente, correo electrónico. No
          pedimos DNI, datos bancarios ni de salud.
        </li>
        <li>
          <strong>Finalidad:</strong> gestionar tu membresía, asistencias, rachas y puntos de fidelización, y avisarte
          de su vencimiento por la app, notificaciones y WhatsApp, además de comunicados del gimnasio.
        </li>
        <li>
          <strong>Consentimiento:</strong> se registra al inscribirte en recepción. Puedes retirarlo en cualquier
          momento.
        </li>
        <li>
          <strong>Conservación y seguridad:</strong> los datos se guardan cifrados en tránsito y con acceso restringido
          por rol (propietario y recepción).
        </li>
        <li>
          <strong>Derechos ARCO:</strong> acceso, rectificación, cancelación y oposición{' '}
          {gym.email ? `escribiendo a ${gym.email} o en` : 'en'} recepción.
        </li>
        <li>
          <strong>Titular del banco de datos:</strong> [POR DEFINIR] razón social y RUC del gimnasio.
        </li>
      </ul>
    </section>
  );
}
