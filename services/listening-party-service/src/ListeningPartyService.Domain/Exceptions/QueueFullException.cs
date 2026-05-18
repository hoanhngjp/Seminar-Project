namespace ListeningPartyService.Domain.Exceptions;

public class QueueFullException(int maxSize)
    : DomainException($"Queue has reached the maximum size of {maxSize}.");
