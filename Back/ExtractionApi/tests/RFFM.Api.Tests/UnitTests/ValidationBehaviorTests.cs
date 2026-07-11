#nullable enable
using FluentValidation;
using FluentValidation.Results;
using Mediator;
using Moq;
using RFFM.Api.Common.Behaviors;
using Xunit;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Regression tests for the bug described in openspec change `unified-error-codes-i18n`:
    /// ValidationBehavior.cs must throw System.ComponentModel.DataAnnotations.ValidationException
    /// (not FluentValidation.ValidationException) so that ServiceCollectionExtensions' 400 mapping
    /// actually catches it instead of falling through to the generic 500 handler.
    /// </summary>
    public class ValidationBehaviorTests
    {
        public record TestRequest(string Name) : IRequest<Unit>;

        [Fact]
        public async Task Handle_WithFailingValidator_ThrowsDataAnnotationsValidationException()
        {
            // Arrange
            var failure = new ValidationFailure("Name", "'Name' no debe estar vacío.");
            var validationResult = new ValidationResult(new[] { failure });

            var validatorMock = new Mock<IValidator<TestRequest>>();
            validatorMock
                .Setup(v => v.Validate(It.IsAny<ValidationContext<TestRequest>>()))
                .Returns(validationResult);

            var behavior = new ValidationBehavior<TestRequest, Unit>(new[] { validatorMock.Object });
            var request = new TestRequest(string.Empty);

            static ValueTask<Unit> Next(TestRequest r, CancellationToken ct) => ValueTask.FromResult(Unit.Value);

            // Act + Assert
            var exception = await Assert.ThrowsAsync<ValidationException>(
                async () => await behavior.Handle(request, Next, CancellationToken.None));

            Assert.IsType<ValidationException>(exception);
            Assert.Contains("Name", exception.Message);
        }

        [Fact]
        public async Task Handle_WithPassingValidators_CallsNext()
        {
            // Arrange
            var validatorMock = new Mock<IValidator<TestRequest>>();
            validatorMock
                .Setup(v => v.Validate(It.IsAny<ValidationContext<TestRequest>>()))
                .Returns(new ValidationResult());

            var behavior = new ValidationBehavior<TestRequest, Unit>(new[] { validatorMock.Object });
            var request = new TestRequest("Valid Name");
            var nextCalled = false;

            ValueTask<Unit> Next(TestRequest r, CancellationToken ct)
            {
                nextCalled = true;
                return ValueTask.FromResult(Unit.Value);
            }

            // Act
            await behavior.Handle(request, Next, CancellationToken.None);

            // Assert
            Assert.True(nextCalled);
        }
    }
}
