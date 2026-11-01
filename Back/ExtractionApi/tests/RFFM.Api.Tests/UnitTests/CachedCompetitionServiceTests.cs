#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Services;
using Xunit;
using static RFFM.Api.Features.Federation.Competitions.Queries.GetScores;

namespace RFFM.Api.Tests.UnitTests
{
    public class CachedCompetitionServiceTests
    {
        private static readonly ResponseCompetition[] OneCompetition = [new(1, "Liga", 80, "Cadete")];
        private static readonly ResponseGroup[] OneGroup = [new(10, "Grupo 1", 30)];

        private readonly Mock<ICompetitionService> _inner = new();
        private readonly CachedCompetitionService _service;

        public CachedCompetitionServiceTests()
            => _service = new CachedCompetitionService(_inner.Object, new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public async Task Las_competiciones_de_la_misma_temporada_se_piden_una_sola_vez()
        {
            _inner.Setup(s => s.GetCompetitionsAsync(22, It.IsAny<CancellationToken>())).ReturnsAsync(OneCompetition);

            await _service.GetCompetitionsAsync(22);
            var second = await _service.GetCompetitionsAsync(22);

            Assert.Same(OneCompetition, second);
            _inner.Verify(s => s.GetCompetitionsAsync(22, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Las_competiciones_de_otra_temporada_no_reutilizan_la_cache()
        {
            _inner.Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>())).ReturnsAsync(OneCompetition);

            await _service.GetCompetitionsAsync(22);
            await _service.GetCompetitionsAsync(21);

            _inner.Verify(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task Una_respuesta_vacia_de_competiciones_no_se_guarda_para_reintentar_en_la_siguiente_peticion()
        {
            _inner.Setup(s => s.GetCompetitionsAsync(22, It.IsAny<CancellationToken>())).ReturnsAsync([]);

            await _service.GetCompetitionsAsync(22);
            await _service.GetCompetitionsAsync(22);

            _inner.Verify(s => s.GetCompetitionsAsync(22, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task Los_grupos_de_una_competicion_se_piden_una_sola_vez()
        {
            _inner.Setup(s => s.GetGroupsAsync("1", It.IsAny<CancellationToken>())).ReturnsAsync(OneGroup);

            await _service.GetGroupsAsync("1");
            await _service.GetGroupsAsync("1");

            _inner.Verify(s => s.GetGroupsAsync("1", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Una_respuesta_vacia_de_grupos_no_se_guarda()
        {
            _inner.Setup(s => s.GetGroupsAsync("1", It.IsAny<CancellationToken>())).ReturnsAsync([]);

            await _service.GetGroupsAsync("1");
            await _service.GetGroupsAsync("1");

            _inner.Verify(s => s.GetGroupsAsync("1", It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task Los_goleadores_de_un_grupo_se_piden_una_sola_vez()
        {
            ResponseScores[] scores = [new() { PlayerName = "Ana", Scores = 3 }];
            _inner.Setup(s => s.GetScoresAsync("1", "10", It.IsAny<CancellationToken>())).ReturnsAsync(scores);

            await _service.GetScoresAsync("1", "10");
            await _service.GetScoresAsync("1", "10");

            _inner.Verify(s => s.GetScoresAsync("1", "10", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task La_clasificacion_de_un_grupo_se_pide_una_sola_vez()
        {
            var classification = new ClassificationResponse { Teams = [new TeamResponse { TeamId = "E1" }] };
            _inner.Setup(s => s.GetClassification(10, It.IsAny<CancellationToken>())).ReturnsAsync(classification);

            await _service.GetClassification(10, CancellationToken.None);
            var second = await _service.GetClassification(10, CancellationToken.None);

            Assert.Same(classification, second);
            _inner.Verify(s => s.GetClassification(10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Una_clasificacion_sin_equipos_no_se_guarda()
        {
            _inner.Setup(s => s.GetClassification(10, It.IsAny<CancellationToken>())).ReturnsAsync(new ClassificationResponse());

            await _service.GetClassification(10, CancellationToken.None);
            await _service.GetClassification(10, CancellationToken.None);

            _inner.Verify(s => s.GetClassification(10, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }
    }

    public class CachedMatchDayServiceTests
    {
        private readonly Mock<IMatchDayService> _inner = new();
        private readonly CachedMatchDayService _service;

        public CachedMatchDayServiceTests()
            => _service = new CachedMatchDayService(_inner.Object, new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public async Task Las_jornadas_de_un_grupo_se_piden_una_sola_vez()
        {
            var days = new List<MatchDayResponse> { new() { MatchDayNumber = 1, MatchDayDate = new DateTime(2026, 10, 4) } };
            _inner.Setup(s => s.GetMatchDays(10, It.IsAny<CancellationToken>())).ReturnsAsync(days);

            await _service.GetMatchDays(10, CancellationToken.None);
            var second = await _service.GetMatchDays(10, CancellationToken.None);

            Assert.Same(days, second);
            _inner.Verify(s => s.GetMatchDays(10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Una_lista_de_jornadas_vacia_no_se_guarda()
        {
            _inner.Setup(s => s.GetMatchDays(10, It.IsAny<CancellationToken>())).ReturnsAsync([]);

            await _service.GetMatchDays(10, CancellationToken.None);
            await _service.GetMatchDays(10, CancellationToken.None);

            _inner.Verify(s => s.GetMatchDays(10, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task La_jornada_activa_de_un_grupo_se_pide_una_sola_vez()
        {
            var active = new MatchDayResponse { MatchDayNumber = 4, MatchDayDate = new DateTime(2026, 11, 1) };
            _inner.Setup(s => s.GetActiveMatchDay(10, It.IsAny<CancellationToken>())).ReturnsAsync(active);

            await _service.GetActiveMatchDay(10, CancellationToken.None);
            var second = await _service.GetActiveMatchDay(10, CancellationToken.None);

            Assert.Same(active, second);
            _inner.Verify(s => s.GetActiveMatchDay(10, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Si_no_hay_jornada_activa_no_se_guarda_el_resultado()
        {
            _inner.Setup(s => s.GetActiveMatchDay(10, It.IsAny<CancellationToken>())).ReturnsAsync((MatchDayResponse?)null);

            await _service.GetActiveMatchDay(10, CancellationToken.None);
            await _service.GetActiveMatchDay(10, CancellationToken.None);

            _inner.Verify(s => s.GetActiveMatchDay(10, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }
    }
}
