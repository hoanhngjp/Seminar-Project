namespace ListeningPartyService.Domain.Exceptions;

public class RoomNotFoundException(string joinCode)
    : DomainException($"Room with join code '{joinCode}' not found or has expired.");
