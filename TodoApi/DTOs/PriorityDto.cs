using System.ComponentModel.DataAnnotations;

namespace TodoApi.DTOs;

public class PriorityDto
{
    [Range(1, int.MaxValue)]
    public int PriorityOrder { get; set; }
}
