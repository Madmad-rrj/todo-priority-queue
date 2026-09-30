using Microsoft.EntityFrameworkCore;
using TodoApi.Models;

namespace TodoApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TaskItem>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(task => task.Id);
            entity.Property(task => task.Content).HasMaxLength(200).IsRequired();
            entity.Property(task => task.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.HasIndex(task => new { task.Status, task.PriorityOrder });
        });
    }
}
