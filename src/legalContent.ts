// ─── CONTENIDO LEGAL (se muestra en la app desde Perfil) ─────────────────────
// Formato: markdown simple (#, ##, **negrita**, - listas). Se renderiza con
// un parser ligero propio en App.tsx (LegalModal), sin librerías externas.
// Si editas el contenido de las políticas, edita este archivo — es la única
// fuente de verdad, tanto para la app como para publicarlo en la web si hace falta.

export const PRIVACY_POLICY_MD = `# Política de Privacidad de CubaGest

**Última actualización:** 30 de julio de 2026

## 1. Responsable del tratamiento de datos

CubaGest es un servicio de gestión empresarial (inventario, punto de venta, facturación, contabilidad y cierre de caja) operado por:

- **Responsable:** [TU NOMBRE COMPLETO], persona natural
- **País de operación:** Cuba
- **Correo de contacto:** cubagest@gmail.com

Al usar CubaGest, aceptas las prácticas descritas en esta Política de Privacidad.

## 2. Datos que recopilamos

Para poder ofrecerte el servicio, recopilamos las siguientes categorías de datos:

### 2.1 Datos de cuenta
- Nombre
- Correo electrónico
- Contraseña (almacenada de forma cifrada, nunca en texto plano)
- Rol asignado dentro del sistema (administrador, cajero, contador, almacenista)

### 2.2 Datos del negocio
- Productos e inventario (nombres, categorías, precios, existencias)
- Ventas, facturas y movimientos de caja
- Historial de operaciones y reportes generados dentro de la plataforma

### 2.3 Datos de pago
- Al contratar un plan de pago (Pro o Empresarial), el procesamiento del cobro se realiza a través de **QvaPay**, un proveedor externo. CubaGest **no almacena** datos de tarjetas ni credenciales financieras; esa información es gestionada directamente por QvaPay conforme a su propia política de privacidad.
- Sí guardamos el estado de tu suscripción (plan activo, fecha de renovación) para administrar tu acceso al servicio.

### 2.4 Datos almacenados localmente (modo offline)
CubaGest permite trabajar sin conexión. En ese modo, los datos de ventas e inventario se guardan temporalmente en el dispositivo (almacenamiento local del navegador/app) hasta que se sincronizan con nuestro servidor al recuperar la conexión.

## 3. Dónde se almacenan los datos

Los datos se almacenan en un servidor propio alojado en la infraestructura de **Railway**, proveedor de hosting que actúa como encargado técnico del tratamiento. Railway no tiene acceso al contenido de tus datos más allá de alojar la infraestructura.

## 4. Para qué usamos tus datos

- Crear y administrar tu cuenta y la de tu equipo de trabajo.
- Permitir el funcionamiento del inventario, punto de venta, facturación y cierre de caja.
- Procesar el pago y la renovación de tu plan de suscripción.
- Enviarte notificaciones y alertas relacionadas con tu negocio dentro de la plataforma.
- Brindar soporte técnico cuando lo solicites.
- Mejorar y corregir el funcionamiento del servicio.

No vendemos ni cedemos tus datos a terceros con fines publicitarios.

## 5. Con quién compartimos datos

Solo compartimos datos con los proveedores estrictamente necesarios para operar el servicio:

- **QvaPay:** para procesar los pagos de suscripción.
- **Railway:** como proveedor de hosting/infraestructura del servidor.

No compartimos tus datos con ningún otro tercero salvo obligación legal.

## 6. Tus derechos

Puedes solicitarnos en cualquier momento:

- Acceder a los datos que tenemos sobre ti o tu negocio.
- Corregir datos inexactos.
- Eliminar tu cuenta y los datos asociados, salvo aquellos que debamos conservar por motivos legales o contables.
- Exportar la información de tu negocio (productos, ventas, facturas) antes de eliminar tu cuenta.

Para ejercer cualquiera de estos derechos, escríbenos a **cubagest@gmail.com**.

## 7. Conservación de datos

Conservamos tus datos mientras tu cuenta esté activa. Si cancelas tu cuenta, eliminaremos o anonimizaremos tus datos en un plazo razonable, salvo que la ley exija conservarlos por más tiempo (por ejemplo, información contable o de facturación).

## 8. Seguridad

Aplicamos medidas razonables para proteger tus datos, incluyendo:

- Cifrado de contraseñas.
- Autenticación mediante token para acceder a la API.
- Cierre de sesión automático cuando el token expira.

Ningún sistema es 100% infalible; en caso de un incidente de seguridad que afecte tus datos, te notificaremos según corresponda.

## 9. Menores de edad

CubaGest es una herramienta de gestión empresarial dirigida a personas adultas que operan un negocio. No está diseñada para ser usada por menores de edad, y no recopilamos intencionalmente datos de menores.

## 10. Cambios a esta política

Podemos actualizar esta Política de Privacidad ocasionalmente. Publicaremos cualquier cambio con la fecha de "Última actualización" al inicio del documento. El uso continuado de CubaGest después de un cambio implica tu aceptación de la nueva versión.

## 11. Contacto

Si tienes preguntas sobre esta Política de Privacidad o sobre cómo tratamos tus datos, escríbenos a:

📧 **cubagest@gmail.com**
`;

export const TERMS_MD = `# Términos y Condiciones de CubaGest

**Última actualización:** 30 de julio de 2026

Estos Términos y Condiciones ("Términos") regulan el uso de CubaGest, un servicio de gestión empresarial (inventario, punto de venta, facturación, contabilidad y cierre de caja) ofrecido por:

- **Responsable:** [TU NOMBRE COMPLETO], persona natural
- **País:** Cuba
- **Contacto:** cubagest@gmail.com

Al crear una cuenta o usar CubaGest, aceptas estos Términos en su totalidad. Si no estás de acuerdo, no debes usar el servicio.

## 1. Descripción del servicio

CubaGest es una plataforma que permite a negocios gestionar:

- Inventario y productos
- Ventas y punto de venta (POS), incluyendo modo offline con sincronización posterior
- Facturación
- Contabilidad y cierre de caja
- Usuarios con distintos roles y permisos (administrador, cajero, contador, almacenista)

## 2. Registro de cuenta

- Debes proporcionar información veraz al crear tu cuenta.
- Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.
- Si detectas un uso no autorizado de tu cuenta, debes notificarlo de inmediato a cubagest@gmail.com.
- El administrador de la cuenta es responsable de gestionar los accesos y permisos de los demás usuarios de su negocio (cajero, contador, almacenista, etc.).

## 3. Planes y pagos

CubaGest ofrece los siguientes planes:

- Gratuito: $0
- Pro: $5 USD/mes
- Empresarial: $10 USD/mes

- Los pagos de los planes Pro y Empresarial se procesan a través de **QvaPay**, y se renuevan automáticamente cada 30 días.
- Puedes cancelar tu suscripción en cualquier momento. La cancelación detiene la renovación futura, pero **no genera reembolsos** por el período ya pagado; conservarás el acceso al plan hasta el final del ciclo vigente.
- Nos reservamos el derecho de modificar los precios o características de los planes, notificando dichos cambios con antelación razonable.
- El impago o rechazo de un cobro puede resultar en la suspensión o degradación automática de tu cuenta al plan gratuito.

## 4. Uso aceptable

Al usar CubaGest, te comprometes a:

- No usar la plataforma para actividades ilícitas, fraudulentas o que infrinjan derechos de terceros.
- No intentar vulnerar la seguridad del sistema, acceder a cuentas ajenas o interferir con el funcionamiento del servicio.
- No revender, sublicenciar o distribuir el acceso a CubaGest sin autorización.
- Ser responsable de la exactitud de los datos de tu negocio (inventario, precios, facturas) que ingreses en la plataforma.

## 5. Modo offline y sincronización

CubaGest permite operar sin conexión a internet, almacenando temporalmente los datos en el dispositivo. Es tu responsabilidad asegurarte de que el dispositivo sincronice correctamente al recuperar la conexión. No nos hacemos responsables de pérdidas de datos causadas por fallos del dispositivo, desinstalación de la aplicación o borrado del almacenamiento local antes de sincronizar.

## 6. Disponibilidad del servicio

Nos esforzamos por mantener CubaGest disponible de forma continua, pero no garantizamos un funcionamiento ininterrumpido o libre de errores. El servicio se ofrece **"tal cual"** ("as is"), sin garantías de ningún tipo, expresas o implícitas.

Podemos realizar mantenimientos, actualizaciones o interrupciones temporales del servicio sin previo aviso cuando sea necesario.

## 7. Limitación de responsabilidad

En la máxima medida permitida por la ley, no seremos responsables por:

- Pérdidas de ingresos, datos o beneficios derivadas del uso o la imposibilidad de uso de CubaGest.
- Errores en cálculos de inventario, ventas o facturación causados por datos ingresados incorrectamente por el usuario.
- Interrupciones del servicio causadas por terceros (proveedores de hosting, conectividad a internet, QvaPay, etc.).

Recomendamos exportar y respaldar periódicamente la información importante de tu negocio.

## 8. Propiedad intelectual

El software, diseño, marca y contenido de CubaGest son propiedad de [TU NOMBRE COMPLETO]. Los datos que ingreses sobre tu negocio (productos, ventas, facturas) siguen siendo de tu propiedad; nosotros solo los almacenamos y procesamos para prestarte el servicio.

## 9. Suspensión y terminación

Podemos suspender o cancelar tu cuenta si:

- Incumples estos Términos.
- Detectamos un uso fraudulento o abusivo de la plataforma.
- Existen impagos reiterados de tu suscripción.

Puedes cancelar tu cuenta en cualquier momento contactándonos o desde la configuración de la aplicación.

## 10. Ley aplicable

Estos Términos se rigen por las leyes de la República de Cuba. Cualquier disputa relacionada con el uso de CubaGest se resolverá conforme a dicha legislación.

## 11. Cambios a estos Términos

Podemos actualizar estos Términos ocasionalmente. Publicaremos la nueva versión con la fecha de "Última actualización" al inicio del documento. El uso continuado del servicio después de un cambio implica tu aceptación de los nuevos Términos.

## 12. Contacto

Para dudas sobre estos Términos y Condiciones, escríbenos a:

📧 **cubagest@gmail.com**
`;
