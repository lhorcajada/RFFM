#nullable enable
using System.Collections.Generic;
using RFFM.Api.Features.Coaches.Kits;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class SaveClubKitsValidatorTests
    {
        private static SaveClubKits.SaveClubKitsCommand ValidCommand() => new()
        {
            TeamId = "team-1",
            Kits = new List<SaveClubKits.SaveClubKitRequest>
            {
                new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
            }
        };

        [Fact]
        public void Validate_ValidCommand_IsValid()
        {
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(ValidCommand());
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_OneKitOnly_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ThreeKits_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" },
                    new() { KitNumber = 3, ShirtColor = "#00FF00", ShortsColor = "#00FF00", SocksColor = "#00FF00" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_DuplicateKitNumber1_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 1, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_KitNumber3_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 3, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ShirtColorNotHex_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "azul", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ShirtColorWrongLength_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#12", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ShortsColorNotHex_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "blanco", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_SocksColorNotHex_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "negro" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_SocksColorEmpty_IsInvalid()
        {
            var command = ValidCommand() with
            {
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_ValidHexColorsWithKitNumbers1And2_IsValid()
        {
            var command = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = "team-1",
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#123456" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#ABCDEF" }
                }
            };
            var validator = new SaveClubKits.Validator();
            var result = validator.Validate(command);
            Assert.True(result.IsValid);
        }
    }
}
