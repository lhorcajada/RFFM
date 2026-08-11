#nullable enable
using System.Linq;
using RFFM.Api.Infrastructure.GameModelImport;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Golden-fixture test using the exact worked example from
    /// `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` §6 as the expected import
    /// output for that fragment of the legible document.
    /// </summary>
    public class AdnLegibleImporterTests
    {
        private const string GoldenFixtureMarkdown = """
            ## 1. Defensa organizada

            1. **No permitir progresar al rival.** Objetivo transversal de toda la fase: impedir que el rival avance hacia nuestra portería, sin especificar todavía la vía concreta (puede ser por dentro, por fuera o en profundidad — eso lo definen los subprincipios).

               - **Subprincipio 1.1 — Evitar que el rival supere nuestra primera línea de presión.** Una de las formas de no dejar progresar al rival es no permitirle superar con comodidad la línea más adelantada de presión, obligándole a jugar hacia atrás, hacia los lados, o a perder el balón directamente ahí.

                 - **Zona de Finalización.** La zona más cercana a la portería rival — aquí el equipo presiona altísimo, buscando robar lo más lejos posible de nuestra portería. Se aceptan riesgos calculados. Sistema base asumido: 1-4-2-3-1.

                   - **Sub-subprincipio 1.1.1 — Delantero:** Arranca desde el carril central pegado al área, presiona al central con balón, corriendo en curva entre el central y el portero, para obligarle a centrar hacia la banda.
                     - Habilidad imprescindible — **Activación**: Arranca la presión en cuanto detecta el movimiento del balón hacia el central, no cuando ya lo ha recibido o controlado. (Entrenable: Presión iniciada a la señal del pase hacia el central, penalizando la salida tardía tras la recepción.)
                     - Habilidad imprescindible — **Perfilamiento**: Orienta el cuerpo en la carrera describiendo una curva, para cerrar la vía de pase más segura (hacia atrás) y forzar el pase lateral. (Entrenable: Ejercicios de presión al central con portero, evaluando si el ángulo de aproximación cierra la vía de vuelta.)

                   *Riesgo aceptado: El lateral opuesto rival queda completamente libre. Se acepta porque está lejos del balón y del peligro inmediato — la recompensa de robar cerca de su área compensa el riesgo.*
            """;

        [Fact]
        public void Parse_GoldenFixture_ProducesExactExpectedEntities()
        {
            var importer = new AdnLegibleImporter();

            var result = importer.Parse(GoldenFixtureMarkdown);

            var principio = Assert.Single(result.Principios);
            Assert.Equal("defensa-organizada-1", principio.Key);
            Assert.Equal("defensa-organizada", principio.FaseSlug);
            Assert.Equal(1, principio.Numero);
            Assert.Equal("No permitir progresar al rival", principio.Titulo);
            Assert.Equal(
                "Objetivo transversal de toda la fase: impedir que el rival avance hacia nuestra portería, sin especificar todavía la vía concreta (puede ser por dentro, por fuera o en profundidad — eso lo definen los subprincipios).",
                principio.Texto);

            var subprincipio = Assert.Single(principio.Subprincipios);
            Assert.Equal("defensa-organizada-1.1", subprincipio.Key);
            Assert.Equal("1.1", subprincipio.Numero);
            Assert.Equal("Evitar que el rival supere nuestra primera línea de presión", subprincipio.Titulo);
            Assert.Equal(
                "Una de las formas de no dejar progresar al rival es no permitirle superar con comodidad la línea más adelantada de presión, obligándole a jugar hacia atrás, hacia los lados, o a perder el balón directamente ahí.",
                subprincipio.Texto);

            var zona = Assert.Single(subprincipio.Zonas);
            Assert.Equal("defensa-organizada-1.1-finalizacion", zona.Key);
            Assert.Equal("finalizacion", zona.ZoneKeysCsv);
            Assert.Equal(
                "La zona más cercana a la portería rival — aquí el equipo presiona altísimo, buscando robar lo más lejos posible de nuestra portería. Se aceptan riesgos calculados. Sistema base asumido: 1-4-2-3-1.",
                zona.Texto);
            Assert.Empty(subprincipio.SubSubPrincipios);

            var ssp = Assert.Single(zona.SubSubPrincipios);
            Assert.Equal("defensa-organizada-1.1.1", ssp.Key);
            Assert.Equal("1.1.1", ssp.Numero);
            Assert.Equal("Delantero", ssp.Rol);
            Assert.Equal(
                "Arranca desde el carril central pegado al área, presiona al central con balón, corriendo en curva entre el central y el portero, para obligarle a centrar hacia la banda.",
                ssp.Texto);

            Assert.Equal(2, ssp.Habilidades.Count);

            var activacion = ssp.Habilidades.Single(h => h.Nombre == "Activación");
            Assert.Equal(
                "Arranca la presión en cuanto detecta el movimiento del balón hacia el central, no cuando ya lo ha recibido o controlado",
                activacion.Descripcion);
            Assert.Equal(
                "Presión iniciada a la señal del pase hacia el central, penalizando la salida tardía tras la recepción.",
                activacion.Entrenable);

            var perfilamiento = ssp.Habilidades.Single(h => h.Nombre == "Perfilamiento");
            Assert.Equal(
                "Orienta el cuerpo en la carrera describiendo una curva, para cerrar la vía de pase más segura (hacia atrás) y forzar el pase lateral",
                perfilamiento.Descripcion);

            var nota = Assert.Single(result.Notas);
            Assert.Equal("riesgo-aceptado", nota.Tipo);
            Assert.Equal(zona.Key, nota.AnchorKey);
            Assert.Equal(
                "El lateral opuesto rival queda completamente libre. Se acepta porque está lejos del balón y del peligro inmediato — la recompensa de robar cerca de su área compensa el riesgo.",
                nota.Texto);
        }

        [Fact]
        public void Parse_HabilidadOutsideKnownVocabulary_Throws()
        {
            const string markdown = """
                ## 1. Defensa organizada

                1. **No permitir progresar al rival.** Texto.

                   - **Subprincipio 1.1 — Título.** Texto.

                     - **Sub-subprincipio 1.1.1 — Delantero:** Texto.
                       - Habilidad imprescindible — **Regate**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            Assert.Throws<GameModelImportException>(() => importer.Parse(markdown));
        }

        [Fact]
        public void Parse_UnresolvableZonaHeading_Throws()
        {
            const string markdown = """
                ## 1. Defensa organizada

                1. **No permitir progresar al rival.** Texto.

                   - **Subprincipio 1.1 — Título.** Texto.

                     - **Zona rara que no existe en ningún catálogo.** Texto.
                """;

            var importer = new AdnLegibleImporter();

            Assert.Throws<GameModelImportException>(() => importer.Parse(markdown));
        }

        [Fact]
        public void Parse_ZonaCreacionRivalCreacionPropiaCompoundHeading_ResolvesToBothZoneKeys()
        {
            const string markdown = """
                ## 3. Ataque organizado

                1. **Progresar con balón.** Texto.

                   - **Subprincipio 1.1 — Título.** Texto.

                     - **Zona de Creación Rival / Creación Propia.** Texto de la zona.

                       - **Sub-subprincipio 1.1.1 — Delantero:** Texto.
                         - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var zona = Assert.Single(result.Principios.Single().Subprincipios.Single().Zonas);
            Assert.Equal("creacion-rival,creacion-propia", zona.ZoneKeysCsv);
            Assert.Null(zona.ZonaTexto);
        }

        [Fact]
        public void Parse_ZonaFinalizacionYCreacionRival_ResolvesToBothZoneKeys()
        {
            const string markdown = """
                ## 1. Defensa organizada

                2. **Recuperar el balón.** Texto.

                   - **Subprincipio 2.3 — Título.** Texto.

                     - **Zona de Finalización y Zona de Creación Rival.** Texto de la zona.

                       - **Sub-subprincipio 2.3.1 — Delantero:** Texto.
                         - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var zona = Assert.Single(result.Principios.Single().Subprincipios.Single().Zonas);
            Assert.Equal("finalizacion,creacion-rival", zona.ZoneKeysCsv);
            Assert.Null(zona.Label);
        }

        [Fact]
        public void Parse_ZonaFinalizacionCreacionRivalYCreacionPropia_ResolvesToThreeZoneKeys()
        {
            const string markdown = """
                ## 1. Defensa organizada

                2. **Recuperar el balón.** Texto.

                   - **Subprincipio 2.4 — Título.** Texto.

                     - **Zona de Finalización, Creación Rival y Creación Propia.** Texto de la zona.

                       - **Sub-subprincipio 2.4.1 — Delantero:** Texto.
                         - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var zona = Assert.Single(result.Principios.Single().Subprincipios.Single().Zonas);
            Assert.Equal("finalizacion,creacion-rival,creacion-propia", zona.ZoneKeysCsv);
        }

        [Fact]
        public void Parse_ZonaIniciacionYCreacionPropiaRiesgoBajo_ResolvesWithLabel()
        {
            const string markdown = """
                ## 3. Ataque organizado

                1. **Progresar con balón.** Texto.

                   - **Subprincipio 1.2 — Título.** Texto.

                     - **Zona de Iniciación y Zona de Creación Propia (riesgo bajo).** Texto de la zona.

                       - **Sub-subprincipio 1.2.1 — Delantero:** Texto.
                         - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var zona = Assert.Single(result.Principios.Single().Subprincipios.Single().Zonas);
            Assert.Equal("iniciacion,creacion-propia", zona.ZoneKeysCsv);
            Assert.Equal("riesgo bajo", zona.Label);
        }

        [Fact]
        public void Parse_ZonaCreacionRivalYFinalizacionRiesgoAsumible_ResolvesWithLabel()
        {
            const string markdown = """
                ## 3. Ataque organizado

                1. **Progresar con balón.** Texto.

                   - **Subprincipio 1.2 — Título.** Texto.

                     - **Zona de Creación Rival y Zona de Finalización (riesgo asumible).** Texto de la zona.

                       - **Sub-subprincipio 1.2.2 — Delantero:** Texto.
                         - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var zona = Assert.Single(result.Principios.Single().Subprincipios.Single().Zonas);
            Assert.Equal("creacion-rival,finalizacion", zona.ZoneKeysCsv);
            Assert.Equal("riesgo asumible", zona.Label);
        }

        [Fact]
        public void Parse_FaseLevelNotaBeforeFirstPrincipio_AnchorsToFirstPrincipio()
        {
            const string markdown = """
                ## 3. Ataque organizado

                *Nota de identidad: a diferencia de Defensa organizada, aquí los Principios no son solo la etapa genérica.*

                1. **Progresar con balón.** Texto.

                   - **Subprincipio 1.1 — Título.** Texto.
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var principio = Assert.Single(result.Principios);
            var nota = Assert.Single(result.Notas);
            Assert.Equal(principio.Key, nota.AnchorKey);
            Assert.Equal("nota", nota.Tipo);
            Assert.Equal("a diferencia de Defensa organizada, aquí los Principios no son solo la etapa genérica.", nota.Texto);
        }

        [Fact]
        public void Parse_MismaQueReference_ResolvesInSecondPass()
        {
            const string markdown = """
                ## 1. Defensa organizada

                1. **Principio.** Texto.

                   - **Subprincipio 1.1 — Título.** Texto.

                     - **Sub-subprincipio 1.1.1 — Rol A:** Texto.
                       - Habilidad imprescindible — **Anticipación**: Descripcion. (Entrenable: Entrenable.)

                     - **Sub-subprincipio 1.1.2 — Rol B:** Texto.
                       - Habilidad imprescindible — **Anticipación** (misma que 1.1.1).
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var sspB = result.Principios.Single().Subprincipios.Single().SubSubPrincipios.Single(s => s.Numero == "1.1.2");
            var habilidad = Assert.Single(sspB.Habilidades);
            Assert.Equal("defensa-organizada-1.1.1", habilidad.ReferenciaAKey);
            Assert.Equal(string.Empty, habilidad.Descripcion);
        }

        [Fact]
        public void Parse_SaqueDeCentroSetPieceHeading_ResolvesToSaqueCentroSubtype()
        {
            const string markdown = """
                ## 5. Balón parado (ABP)

                **Saque de centro.** Saque hacia atrás con golpeo en largo a una banda.
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            var rule = Assert.Single(result.SetPieceRules);
            Assert.Equal("saque-centro", rule.Subtype);
            Assert.Equal("Saque hacia atrás con golpeo en largo a una banda.", rule.Texto);
        }

        [Fact]
        public void Parse_RemovedFilosofiaGeneralAndFormatoReducidoHeadings_NoLongerResolveAsRules()
        {
            const string markdown = """
                ## 5. Balón parado (ABP)

                **Filosofía general.** Texto que ya no es un subtipo válido.

                **Penaltis.** Los lanzadores están prefijados; no se decide en el momento.

                **Formato reducido.** Texto que ya no es un subtipo válido.
                """;

            var importer = new AdnLegibleImporter();

            var result = importer.Parse(markdown);

            Assert.DoesNotContain(result.SetPieceRules, r => r.Subtype == "filosofia-general");
            Assert.DoesNotContain(result.SetPieceRules, r => r.Subtype == "formato-reducido");
            Assert.Contains(result.SetPieceRules, r => r.Subtype == "penaltis");
        }
    }
}
