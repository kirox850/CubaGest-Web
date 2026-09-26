// ─── CONTENIDO LEGAL (se muestra en la app desde Perfil) ─────────────────────
// Formato: markdown simple (#, ##, **negrita**, - listas). Se renderiza con
// un parser ligero propio en App.tsx (LegalModal), sin librerías externas.
// Si editas el contenido de las políticas, edita este archivo — es la única
// fuente de verdad, tanto para la app como para publicarlo en la web si hace falta.

export const PRIVACY_POLICY_MD = `# Política de Privacidad de CubaGest

**Última actualización:** 30 de julio de 2026

## 1. Responsable del tratamiento de datos

CubaGest es un servicio de gestión empresarial (inventario, punto de venta, facturación, contabilidad y cierre de caja) que opera desde Cuba:

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
CubaGest permite trabajar sin conexión. En ese modo, el catálogo de productos, el stock de tu ubicación y las ventas capturadas se guardan en el almacenamiento local del navegador (IndexedDB) y se envían a nuestros servidores al recuperar la conexión.

Esos datos quedan separados por empresa, usuario y ubicación: si otra persona usa el mismo dispositivo con su propia cuenta, no puede ver ni enviar los datos guardados por la tuya.

Al cerrar sesión **no** se borran: se conservan en el dispositivo para que puedas seguir trabajando si te quedas sin conexión. Se eliminan cuando borras los datos de navegación o de la aplicación desde tu dispositivo.

## 3. Dónde se almacenan los datos

Los datos se procesan en la infraestructura de **Cloudflare** (Workers y base de datos D1), que es nuestro proveedor de infraestructura y actúa como encargado técnico del tratamiento. Los datos de tu negocio se guardan en bases de datos separadas por empresa.

## 4. Para qué usamos tus datos

- Crear y administrar tu cuenta y la de tu equipo de trabajo.
- Permitir el funcionamiento del inventario, punto de venta, facturación y cierre de caja.
- Procesar el pago y la renovación de tu plan de suscripción.
- Mostrarte avisos dentro de la plataforma cuando una operación no pudo completarse (por ejemplo, una venta guardada sin conexión que sigue pendiente de sincronizar).
- Brindar soporte técnico cuando lo solicites.
- Mejorar y corregir el funcionamiento del servicio.

No vendemos ni cedemos tus datos a terceros con fines publicitarios.

## 5. Con quién compartimos datos

Solo compartimos datos con los proveedores estrictamente necesarios para operar el servicio:

- **QvaPay:** para procesar los pagos de suscripción.
- **Cloudflare:** como proveedor de infraestructura que aloja y procesa los datos.

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

- Contraseñas cifradas; nunca se guardan en texto plano.
- Tokens de acceso para las peticiones a la API, y renovación automática de la sesión mientras el dispositivo tiene conexión.
- La sesión visible de la app solo se cierra cuando tú la cierras o cuando el servidor deja de aceptarla; la falta de conexión no la cierra.
- Separación de los datos locales por empresa, usuario y ubicación, para que una cuenta no vea los datos de otra en el mismo dispositivo.

Ningún sistema es 100% infalible; en caso de un incidente de seguridad que afecte tus datos, te notificaremos según corresponda.

## 9. Menores de edad

CubaGest es una herramienta de gestión empresarial dirigida a personas adultas que operan un negocio. No está diseñada para ser usada por menores de edad, y no recopilamos intencionalmente datos de menores.

## 10. Cambios a esta política

Podemos actualizar esta Política de Privacidad ocasionalmente. Publicaremos cualquier cambio con la fecha de "Última actualización" al inicio del documento. El uso continuado de CubaGest después de un cambio implica tu aceptación de la nueva versión.

## 11. Contacto

Si tienes preguntas sobre esta Política de Privacidad o sobre cómo tratamos tus datos, escríbenos a:

**cubagest@gmail.com**
`;

export const TERMS_MD = `# Términos y Condiciones de CubaGest

**Última actualización:** 30 de julio de 2026

Estos Términos y Condiciones ("Términos") regulan el uso de CubaGest, un servicio de gestión empresarial (inventario, punto de venta, facturación, contabilidad y cierre de caja) que opera desde Cuba:

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
- Para dejar de renovar basta con escribirnos antes de la fecha del próximo cobro: desactivamos la renovación del plan. No hay reembolsos por el período ya pagado y conservas el acceso hasta el final del ciclo vigente.
- Nos reservamos el derecho de modificar los precios o características de los planes, notificando dichos cambios con antelación razonable.
- El impago o rechazo de un cobro puede resultar en la suspensión o degradación automática de tu cuenta al plan gratuito.

## 4. Uso aceptable

Al usar CubaGest, te comprometes a:

- No usar la plataforma para actividades ilícitas, fraudulentas o que infrinjan derechos de terceros.
- No intentar vulnerar la seguridad del sistema, acceder a cuentas ajenas o interferir con el funcionamiento del servicio.
- No revender, sublicenciar o distribuir el acceso a CubaGest sin autorización.
- Ser responsable de la exactitud de los datos de tu negocio (inventario, precios, facturas) que ingreses en la plataforma.

## 5. Modo offline y sincronización

CubaGest permite operar sin conexión a internet: el punto de venta guarda la venta en el dispositivo, con su identificador propio y la ubicación donde se registró, y la envía al servidor al recuperar la conexión.

- La sincronización ocurre con la aplicación abierta (al entrar, al recuperar la conexión o cuando pulsas "Sincronizar ahora"). Si el dispositivo está apagado o la aplicación cerrada, las ventas permanecen en cola.
- Cada venta conserva su identificador, así que un reintento no genera una factura duplicada.
- Los datos locales se conservan aunque cierres sesión, y se eliminan si borras los datos de navegación o de la aplicación.
- No nos hacemos responsables de pérdidas de datos causadas por fallos del dispositivo, desinstalación de la aplicación o borrado del almacenamiento local antes de sincronizar.

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

El software, diseño, marca y contenido de CubaGest son propiedad de sus titulares. Los datos que ingreses sobre tu negocio (productos, ventas, facturas) siguen siendo de tu propiedad; nosotros solo los almacenamos y procesamos para prestarte el servicio.

## 9. Suspensión y terminación

Podemos suspender o cancelar tu cuenta si:

- Incumples estos Términos.
- Detectamos un uso fraudulento o abusivo de la plataforma.
- Existen impagos reiterados de tu suscripción.

Puedes cancelar tu cuenta en cualquier momento escribiéndonos a cubagest@gmail.com. Al cancelar tu cuenta se eliminan o anonimizan tus datos, salvo los que debamos conservar por motivos legales o contables.

## 10. Ley aplicable

Estos Términos se rigen por las leyes de la República de Cuba. Cualquier disputa relacionada con el uso de CubaGest se resolverá conforme a dicha legislación.

## 11. Cambios a estos Términos

Podemos actualizar estos Términos ocasionalmente. Publicaremos la nueva versión con la fecha de "Última actualización" al inicio del documento. El uso continuado del servicio después de un cambio implica tu aceptación de los nuevos Términos.

## 12. Contacto

Para dudas sobre estos Términos y Condiciones, escríbenos a:

**cubagest@gmail.com**
`;
