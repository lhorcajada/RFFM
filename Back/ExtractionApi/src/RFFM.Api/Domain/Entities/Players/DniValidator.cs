using System.Text.RegularExpressions;

namespace RFFM.Api.Domain.Entities.Players
{
    internal class DniValidator
    {
        internal static bool IsValid(string dniOrNie)
        {
            if (string.IsNullOrEmpty(dniOrNie))
            {
                return false;
            }

            if (dniOrNie.Length != 9)
            {
                return false;
            }

            // Validar formato DNI: 8 dígitos seguidos de una letra
            if (Regex.IsMatch(dniOrNie, @"^\d{8}[A-Z]$"))
            {
                var letter = dniOrNie[8];
                var number = int.Parse(dniOrNie.Substring(0, 8));
                var validLetters = "TRWAGMYFPDXBNJZSQVHLCKE";
                return letter == validLetters[number % 23];
            }

            // Validar formato NIE: empieza con X, Y o Z, seguido de 7 dígitos y una letra
            if (!Regex.IsMatch(dniOrNie, @"^[XYZ]\d{7}[A-Z]$")) return false;
            {
                var letter = dniOrNie[8];
                var prefix = dniOrNie[0];
                var numberPart = dniOrNie.Substring(1, 7);

                // Convertir la letra inicial a un número
                int prefixValue = prefix == 'X' ? 0 : prefix == 'Y' ? 1 : 2;

                // Construir el número completo para el cálculo
                var number = int.Parse(prefixValue + numberPart);
                var validLetters = "TRWAGMYFPDXBNJZSQVHLCKE";
                return letter == validLetters[number % 23];
            }

        }

    }
}